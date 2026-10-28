import {env} from 'cloudflare:workers';
import {notifyAfterMutation} from '../../../lib/server-push';
import {normalizeEmail,isKaistEmail,passwordHash,verifyPassword,validateNewPassword} from '../../../lib/password';
import {initialState,TeamState} from '../../../lib/domain';
import {mutate} from '../../../lib/mutations';
import {resolveLoginIdentifier} from '../../../lib/login-alias';
export const dynamic='force-dynamic';
const db=()=>{if(!env.DB)throw Error('데이터베이스가 연결되지 않았습니다.');return env.DB;};
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(9))).map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
const json=(data:any,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const cookie=(token:string,req:Request,clear=false)=>`courtin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:60*60*24*30}${new URL(req.url).protocol==='https:'?'; Secure':''}`;
async function session(req:Request){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)courtin_session=([^;]+)/)?.[1];if(!token)return null;return await db().prepare('SELECT team, member FROM sessions WHERE hash = ? AND expires > ?').bind(await digest(token),Date.now()).first<{team:string;member:string}>();}
async function account(team:string,member:string){return db().prepare('SELECT email,password,must_change,enabled FROM email_accounts WHERE team=? AND member=?').bind(team,member).first<{email:string;password:string;must_change:number;enabled:number}>();}
async function readTeam(id:string){return db().prepare('SELECT state,version FROM teams WHERE id=?').bind(id).first<{state:string;version:number}>();}
async function limited(req:Request,kind:string,max:number,windowMs:number){const now=Date.now();const key=await digest((kind.startsWith('email-account:')?'':req.headers.get('cf-connecting-ip')||'local')+kind+Math.floor(now/windowMs));const row=await db().prepare('INSERT INTO limits (id,count,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+windowMs).first<{count:number}>();if((row?.count||0)>max)throw Error('시도가 너무 많습니다. 잠시 후 다시 시도해주세요.');await db().prepare('DELETE FROM limits WHERE expires < ?').bind(now-windowMs).run();}
async function createSession(req:Request,team:string,member:string,expectedPassword?:string){const token=random()+random();const result=expectedPassword?await db().prepare('INSERT INTO sessions(hash,team,member,expires) SELECT ?,team,member,? FROM email_accounts WHERE team=? AND member=? AND password=? AND enabled=1').bind(await digest(token),Date.now()+30*86400000,team,member,expectedPassword).run():await db().prepare('INSERT INTO sessions(hash,team,member,expires) VALUES (?,?,?,?)').bind(await digest(token),team,member,Date.now()+30*86400000).run();if(!result.meta.changes)throw Error('로그인 정보가 변경되었습니다. 다시 로그인해주세요.');await db().prepare('DELETE FROM sessions WHERE expires < ?').bind(Date.now()).run();return cookie(token,req);}
export async function GET(req:Request){try{const auth=await session(req);if(!auth)return json({error:'로그인이 필요합니다.'},401);const acc=await account(auth.team,auth.member);if(acc&&!acc.enabled)return json({error:'등록된 계정이 아닙니다.'},401);if(acc?.must_change)return json({requirePasswordChange:true,email:acc.email});const row=await readTeam(auth.team);if(!row||!JSON.parse(row.state).members.some((m:any)=>m.id===auth.member))return json({error:'팀원이 없습니다.'},401);return json({state:JSON.parse(row.state),teamId:auth.team,memberId:auth.member,version:row.version,email:acc?.email});}catch{return json({error:'팀 정보를 불러오지 못했습니다.'},503);}}
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'허용되지 않는 요청입니다.'},403);
 if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'잘못된 요청입니다.'},415);
 const raw=await req.text();if(raw.length>50000)return json({error:'입력이 너무 깁니다.'},413);const {action,payload:p={}}=JSON.parse(raw);
 if(action==='create'){
  if(env.SHEET_SYNC_CONFIG)return json({error:'아크로바틱 부원 전용 앱입니다.'},403);
  await limited(req,'create',5,3600000);
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>40||typeof p.captain!=='string'||!p.captain.trim()||p.captain.length>30)throw Error('팀 이름과 동장 이름을 입력해주세요.');
  const teamId='ACRO-'+random().slice(0,8);const state=initialState(p.name.trim(),p.captain.trim());const codes=state.members.map(m=>({memberId:m.id,code:random()}));
  const inserts=await Promise.all(codes.map(async c=>db().prepare('INSERT INTO credentials(id,team,member,hash) VALUES (?,?,?,?)').bind(crypto.randomUUID(),teamId,c.memberId,await digest(teamId+':'+c.code))));
  await db().batch([db().prepare('INSERT INTO teams(id,state,version) VALUES (?,?,0)').bind(teamId,JSON.stringify(state)),...inserts]);
  return json({state,teamId,memberId:'m1',codes,version:0},200,{'Set-Cookie':await createSession(req,teamId,'m1')});
 }
 if(action==='loginEmail'){
  const email=normalizeEmail(p.email);await limited(req,'email-ip',30,900000);await limited(req,'email-account:'+email,8,900000);
  if(!isKaistEmail(email)||typeof p.password!=='string'||p.password.length>128)return json({error:'이메일 또는 비밀번호가 올바르지 않습니다.'},401);
  const acc=await db().prepare('SELECT email,team,member,password,must_change,enabled FROM email_accounts WHERE email=?').bind(email).first<{email:string;team:string;member:string;password:string;must_change:number;enabled:number}>();
  const fallback='pbkdf2-sha256$100000$00000000000000000000000000000000$'+'0'.repeat(64);
  const verified=await verifyPassword(p.password,acc?.password||fallback,env.AUTH_PEPPER||'');
  if(!acc||!acc.enabled||!verified)return json({error:'이메일 또는 비밀번호가 올바르지 않습니다.'},401);
  const row=await readTeam(acc.team);if(!row||!JSON.parse(row.state).members.some((m:any)=>m.id===acc.member))return json({error:'이메일 또는 비밀번호가 올바르지 않습니다.'},401);
  const headers={'Set-Cookie':await createSession(req,acc.team,acc.member,acc.password)};
  if(acc.must_change)return json({requirePasswordChange:true,email:acc.email},200,headers);
  return json({state:JSON.parse(row.state),teamId:acc.team,memberId:acc.member,version:row.version,email:acc.email},200,headers);
 }
 if(action==='login'){
  await limited(req,'login',20,900000);const identifier=String(p.teamId||'').trim();const code=String(p.code||'').replace(/[\s-]/g,'').toUpperCase();
  if(identifier.length>60||code.length>80)throw Error('팀 ID와 입장코드를 확인해주세요.');
  const target=resolveLoginIdentifier(identifier,env.TEAM_LOGIN_ALIASES),teamId=target.teamId;
  if(await db().prepare('SELECT 1 FROM email_accounts WHERE team=? LIMIT 1').bind(teamId).first())return json({error:'KAIST 이메일과 비밀번호로 로그인해주세요.'},401);
  const credential=await db().prepare('SELECT member FROM credentials WHERE team=? AND hash=?').bind(teamId,await digest(teamId+':'+code)).first<{member:string}>();
  if(!credential||(target.memberId&&target.memberId!==credential.member))return json({error:'팀 ID 또는 개인 입장코드가 올바르지 않습니다.'},401);
  const row=await readTeam(teamId);if(!row)throw Error('팀을 찾을 수 없습니다.');
  return json({state:JSON.parse(row.state),teamId,memberId:credential.member,version:row.version},200,{'Set-Cookie':await createSession(req,teamId,credential.member)});
 }
 const auth=await session(req);if(!auth)return json({error:'다시 로그인해주세요.'},401);
 if(action==='logout'){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)courtin_session=([^;]+)/)?.[1];if(token)await db().prepare('DELETE FROM sessions WHERE hash=?').bind(await digest(token)).run();return json({ok:true},200,{'Set-Cookie':cookie('',req,true)});}
 const acc=await account(auth.team,auth.member);
 if(acc&&!acc.enabled)return json({error:'등록된 계정이 아닙니다.'},401);
 if(action==='changePassword'){
  await limited(req,'password:'+auth.member,8,900000);
  if(!acc||typeof p.currentPassword!=='string'||p.currentPassword.length>128||!await verifyPassword(p.currentPassword,acc.password,env.AUTH_PEPPER||''))return json({error:'현재 비밀번호가 올바르지 않습니다.'},401);
  const next=validateNewPassword(p.newPassword);if(next===p.currentPassword)throw Error('현재 비밀번호와 다른 비밀번호를 입력해주세요.');
  const hashed=await passwordHash(next,env.AUTH_PEPPER||'');
  // Guard the password update against a concurrent change.
  const changed=await db().prepare('UPDATE email_accounts SET password=?,must_change=0 WHERE team=? AND member=? AND password=? RETURNING email').bind(hashed,auth.team,auth.member,acc.password).first();
  if(!changed)return json({error:'비밀번호가 이미 변경되었습니다. 다시 로그인해주세요.'},409);
  await db().prepare('DELETE FROM sessions WHERE team=? AND member=?').bind(auth.team,auth.member).run();
  return json({ok:true},200,{'Set-Cookie':await createSession(req,auth.team,auth.member,hashed)});
 }
 if(acc?.must_change)return json({error:'비밀번호를 먼저 변경해주세요.',requirePasswordChange:true},403);
 if(action==='setup'&&acc)return json({error:'가입 승인과 팀 설정을 사용해주세요.'},400);
 if(action==='transferCaptain'){
  await limited(req,'handover:'+auth.member,5,900000);
  if(!acc||typeof p.currentPassword!=='string'||p.currentPassword.length>128||!await verifyPassword(p.currentPassword,acc.password,env.AUTH_PEPPER||''))return json({error:'현재 비밀번호가 올바르지 않습니다.'},401);
  const target=await account(auth.team,String(p.member||''));if(!target||!target.enabled||target.must_change)throw Error('인계받을 부원이 먼저 로그인하고 비밀번호를 변경해야 합니다.');
 }
 if(action==='invite'){
  if(acc)return json({error:'이메일 로그인 계정은 입장코드를 사용하지 않습니다.'},400);
  const row=await readTeam(auth.team);const state:TeamState=JSON.parse(row!.state);if(state.members.find(m=>m.id===auth.member)?.role!=='captain')return json({error:'동장만 초대코드를 발급할 수 있습니다.'},403);
  if(!state.members.some(m=>m.id===p.member))throw Error('팀원이 없습니다.');const code=random();
  await db().batch([db().prepare('DELETE FROM credentials WHERE team=? AND member=?').bind(auth.team,p.member),db().prepare('INSERT INTO credentials(id,team,member,hash) VALUES (?,?,?,?)').bind(crypto.randomUUID(),auth.team,p.member,await digest(auth.team+':'+code)),db().prepare('DELETE FROM sessions WHERE team=? AND member=?').bind(auth.team,p.member)]);
  return json({code},200,p.member===auth.member?{'Set-Cookie':await createSession(req,auth.team,auth.member)}:{});
 }
 for(let attempt=0;attempt<4;attempt++){
  const row=await readTeam(auth.team);if(!row)throw Error('팀이 없습니다.');const state=mutate(JSON.parse(row.state),auth.member,action,p);
  const serialized=JSON.stringify(state);
  if(action==='eventCancellation'&&serialized===row.state)return json({state,teamId:auth.team,memberId:auth.member,version:row.version});
  const result=await db().prepare('UPDATE teams SET state=?, version=version+1 WHERE id=? AND version=?').bind(serialized,auth.team,row.version).run();
  if(result.meta.changes){await notifyAfterMutation(auth.team,action,p,state,row.version+1);return json({state,teamId:auth.team,memberId:auth.member,version:row.version+1});}
 }
 return json({error:'다른 팀원이 수정 중입니다. 다시 시도해주세요.'},409);
 }catch(e){return json({error:e instanceof Error&&!/D1|SQL|database|constraint/i.test(e.message)?e.message:'저장하지 못했습니다. 잠시 후 다시 시도해주세요.'},400);}}
