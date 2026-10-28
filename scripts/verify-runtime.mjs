import './sites-env.mjs';
import {pullFixture} from './sheet-pull-fixture.mjs';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {initialState} from '../lib/domain.ts';
import {passwordHash} from '../lib/password.ts';

// A separate disposable D1/R2 state directory; never touches real team data.
const state=path.resolve('.sites-runtime',`verify-${process.pid}`);
fs.mkdirSync(state,{recursive:true});
const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false'};
const allScripts=['scripts/verify-oct18.mjs','scripts/verify-members.mjs','scripts/verify-member-lifecycle.mjs','scripts/verify-login-alias-api.mjs'];
const selectedScripts=process.argv.slice(2);
const pullTest=selectedScripts.includes('scripts/verify-sheet-pull-api.mjs');
const fixture=pullTest?pullFixture():null;
const kakaoTest=selectedScripts.includes('scripts/verify-kakao-api.mjs');
const emailTest=selectedScripts.includes('scripts/verify-email-sheets.mjs');
if(selectedScripts.some(script=>!allScripts.includes(script)&&script!=='scripts/verify-email-sheets.mjs'&&script!=='scripts/verify-sheet-pull-api.mjs'&&script!=='scripts/verify-kakao-api.mjs'))throw Error('Unknown integration test script.');
let worker;
try{
  console.log('Starting isolated local Worker');
  // Exercise the built Worker directly, without the interactive dev proxy's
  // reload/body forwarding layer, including simultaneous upload requests.
  const {unstable_getMiniflareWorkerOptions}=await import('wrangler');
  const {Miniflare}=await import('miniflare');
  const config=unstable_getMiniflareWorkerOptions('dist/server/wrangler.json');
  const serverRoot=path.dirname(config.main);
  const moduleFiles=fs.readdirSync(serverRoot,{recursive:true}).filter(v=>/\.(m?js|wasm)$/.test(v)).map(v=>path.join(serverRoot,v));
  const modules=[config.main,...moduleFiles.filter(v=>v!==config.main)].map(file=>({type:file.endsWith('.wasm')?'CompiledWasm':'ESModule',path:file}));
  let pushRequests=0;const pushSigning=emailTest?await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']):null;const pushPrivate=pushSigning?await crypto.subtle.exportKey('jwk',pushSigning.privateKey):null;
  const bindings={...config.workerOptions.bindings,AUTH_PEPPER:'local-integration-pepper',...(emailTest?{VAPID_PUBLIC_KEY:Buffer.from(await crypto.subtle.exportKey('raw',pushSigning.publicKey)).toString('base64url'),VAPID_PRIVATE_KEY:pushPrivate.d,VAPID_SUBJECT:'https://club.example',SHEET_SYNC_TOKEN:'test-sync-secret',SHEET_SYNC_CONFIG:JSON.stringify({teamId:'EMAIL-TEST',spreadsheetId:'test-sheet'})}:{}),...(pullTest?{AUTH_PEPPER:'local-integration-pepper',SHEET_SYNC_TOKEN:'test-sync-secret',SHEET_SYNC_CONFIG:JSON.stringify({teamId:'PULL-TEST',spreadsheetId:'test-sheet',pullEnabled:true,tabs:{roster:1,ledger:2,minutes:3,dues:4}})}:{}),...(kakaoTest?{KAKAO_BRIDGE_TOKEN:'local-kakao-test-token-with-48-characters-123456789',KAKAO_BRIDGE_TEAM_ID:'KAKAO-TEST',KAKAO_ROOM_ID:'200000000000000001'}:{}),TEAM_LOGIN_ALIASES:JSON.stringify({'ADMIN-EXAMPLE':{teamId:'ACRO-ALIAS-TEST',memberId:'m1'}})};
  const runtime=new Miniflare({host:'127.0.0.1',port:0,cf:false,d1Persist:path.join(state,'v3','d1'),r2Persist:path.join(state,'v3','r2'),workers:[{...config.workerOptions,r2Buckets:{BUCKET:'isolated-test-videos'},name:'acrobatic-integration',...(pullTest?{outboundService:async request=>{const url=new URL(request.url);if(url.hostname!=='docs.google.com')throw Error('Unexpected external CSV request');return new Response(fixture.csv[url.searchParams.get('gid')],{headers:{'content-type':'text/csv'}});}}:{}),...(emailTest?{outboundService:async request=>{if(!new URL(request.url).hostname.endsWith('push.apple.com'))throw Error('Unexpected external test request');pushRequests++;return new Response(null,{status:request.url.endsWith('/gone')?410:201});}}:{}),bindings,modules,modulesRoot:serverRoot},...config.externalWorkers]});
  worker={stop:()=>runtime.dispose()};
  const origin=(await runtime.ready).origin;
  console.log('Local Worker ready: '+origin);
  // Initialize this disposable database through its own runtime binding. This
  // avoids an extra Wrangler subprocess and its shutdown/network lifecycle.
  const database=await runtime.getD1Database('DB','acrobatic-integration');
  const schema=fs.readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort().flatMap(file=>fs.readFileSync(path.join('drizzle',file),'utf8').split('--> statement-breakpoint').map(sql=>sql.trim()).filter(Boolean));
  await database.batch(schema.map(sql=>database.prepare(sql)));
  const aliasTeam='ACRO-ALIAS-TEST';
  await database.prepare('INSERT INTO teams(id,state,version) VALUES (?,?,0)').bind(aliasTeam,JSON.stringify(initialState('Alias test','Captain'))).run();
  for(const [member,code] of [['m1','TESTALIASCAPTAIN'],['m4','TESTALIASPLAYER']]){
   const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(aliasTeam+':'+code))).toString('hex');
   await database.prepare('INSERT INTO credentials(id,team,member,hash) VALUES (?,?,?,?)').bind('alias-'+member,aliasTeam,member,hash).run();
  }
  if(pullTest){
   await database.prepare('INSERT INTO teams(id,state,version) VALUES (?,?,0)').bind('PULL-TEST',JSON.stringify(fixture.state)).run();
   await database.prepare('INSERT INTO sheet_links(team,baseline) VALUES (?,?)').bind('PULL-TEST',JSON.stringify(fixture.baseline)).run();
   for(const m of fixture.state.members)await database.prepare('INSERT INTO email_accounts(email,team,member,password,must_change,enabled) VALUES (?,?,?,?,0,1)').bind(m.sheetProfile.email,'PULL-TEST',m.id,await passwordHash('existing-test-password','local-integration-pepper')).run();
  }
  if(emailTest){
   const state=initialState('Email test','Captain');state.members=[state.members[0],{...state.members[3],id:'m4',name:'Player'}];
   for(const [index,member] of state.members.entries())member.sheetProfile={id:'r'+member.id,semester:'test',joinedSemester:'test',generation:'1',studentNumber:'2099000'+(index+1),name:member.name,office:index?'선수':'동장/주장',position:member.position,secondaryPosition:'',email:index?'player@kaist.ac.kr':'captain@kaist.ac.kr'};
   state.sheetLedger=[];state.meetingMinutes=[];state.rollcall=[];
   await database.prepare('INSERT INTO teams(id,state,version) VALUES (?,?,0)').bind('EMAIL-TEST',JSON.stringify(state)).run();
   for(const [email,member,password,must] of [['captain@kaist.ac.kr','m1','20990001',1],['player@kaist.ac.kr','m4','existing-player-password',0]])await database.prepare('INSERT INTO email_accounts(email,team,member,password,must_change,enabled) VALUES (?,?,?,?,?,1)').bind(email,'EMAIL-TEST',member,await passwordHash(password,'local-integration-pepper'),must).run();
  }
  if(kakaoTest){
   const state=initialState('Kakao test','Captain');state.members=[state.members[0],{...state.members[3],id:'m4',name:'Player'}];
   await database.prepare('INSERT INTO teams(id,state,version) VALUES (?,?,0)').bind('KAKAO-TEST',JSON.stringify(state)).run();
   for(const [email,member,password] of [['captain@kaist.ac.kr','m1','captain-test-password'],['player@kaist.ac.kr','m4','player-test-password']])await database.prepare('INSERT INTO email_accounts(email,team,member,password,must_change,enabled) VALUES (?,?,?,?,0,1)').bind(email,'KAKAO-TEST',member,await passwordHash(password,'local-integration-pepper')).run();
  }
  let ready=false,stableReads=0;
  for(let i=0;i<12;i++){
    // Wrangler may expose the port before its initial worker reload completes.
    // Probe only safe reads until the JSON API is stable; never retry mutations.
    try{const r=await fetch(origin+'/api/team',{signal:AbortSignal.timeout(5000)});const body=await r.json();stableReads=r.status===401&&typeof body.error==='string'?stableReads+1:0;if(stableReads>=4){ready=true;break;}}catch{stableReads=0;}
    await delay(500);
  }
  if(!ready)throw Error('Local test Worker did not start.');
  // Cloudflare redirects /offline.html to /offline. Cache the canonical URL:
  // a redirected cached response cannot serve a navigation with redirect=manual.
  const offline=await fetch(origin+'/offline');
  if(offline.status!==200||offline.redirected||!(await offline.text()).includes('잠시 연결이 끊겼어요'))throw Error('Offline fallback must be a direct HTML response.');
  const manifest=await fetch(origin+'/manifest.webmanifest');
  if(manifest.status!==200||(await manifest.json()).display!=='standalone')throw Error('Install manifest unavailable.');
  // Keep this event loop free to service the local runtime's bindings/proxy.
  for(const script of selectedScripts.length?selectedScripts:allScripts){
   const result=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script],{stdio:'inherit',env:{...env,ACRO_ORIGIN:origin}});child.once('error',reject);child.once('exit',code=>resolve(code));});
   if(result!==0){process.exitCode=result||1;break;}
  }
  if(emailTest&&process.exitCode!==1){if(pushRequests<2)throw Error('Push delivery was not exercised.');console.log('PASS: encrypted Web Push dispatched inside Worker with mocked delivery, no real external messages');}
}catch(error){console.error(error);process.exitCode=1;}
finally{
  await worker?.stop();
}
