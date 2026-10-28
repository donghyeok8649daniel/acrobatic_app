import {env} from 'cloudflare:workers';
import {database} from './server-team';
import type {TeamState} from './domain';
import {mutate} from './mutations';
import {parseKakaoCommand,publishedTrainings,selectKakaoTraining,trainingSummary} from './kakao';

export const kakaoConfigured=()=>!!(env.KAKAO_BRIDGE_TOKEN&&env.KAKAO_BRIDGE_TOKEN.length>=32&&env.KAKAO_BRIDGE_TEAM_ID&&/^\d{1,30}$/.test(env.KAKAO_ROOM_ID||''));
export async function kakaoHash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function bridgeAuthorized(req:Request){if(!kakaoConfigured())return false;const actual=await kakaoHash(req.headers.get('authorization')||''),expected=await kakaoHash('Bearer '+env.KAKAO_BRIDGE_TOKEN);let diff=0;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);return diff===0;}
const team=()=>env.KAKAO_BRIDGE_TEAM_ID!;
const read=()=>database().prepare('SELECT state,version FROM teams WHERE id=?').bind(team()).first<{state:string;version:number}>();
async function enabled(member:string){return !!await database().prepare('SELECT 1 FROM email_accounts WHERE team=? AND member=? AND enabled=1 AND must_change=0').bind(team(),member).first();}
export async function kakaoStatus(teamId:string,member:string,captain:boolean){
 const configured=kakaoConfigured()&&teamId===team();if(!configured)return {configured:false,linked:false,serverOnline:false,irisReady:false};
 const link=await database().prepare('SELECT sender FROM kakao_links WHERE team=? AND member=?').bind(teamId,member).first<{sender:string|null}>();
 const health=await database().prepare('SELECT * FROM kakao_health WHERE team=?').bind(teamId).first<{checked_at:number;iris_ready:number;pending:number;uncertain:number}>();
 return {configured:true,linked:!!link?.sender,serverOnline:!!health&&Date.now()-health.checked_at<60000,irisReady:!!health?.iris_ready,pending:health?.pending||0,uncertain:health?.uncertain||0,lastChecked:health?.checked_at||null,...(captain?{links:(await database().prepare('SELECT member FROM kakao_links WHERE team=? AND sender IS NOT NULL').bind(teamId).all()).results}: {})};
}
export async function makeKakaoLinkCode(teamId:string,member:string){
 if(!kakaoConfigured()||teamId!==team())throw Error('카톡 봇 서버 연결을 먼저 완료해야 합니다.');
 const key=await kakaoHash('kakao-code:'+teamId+':'+member+':'+Math.floor(Date.now()/60000));const count=await database().prepare('INSERT INTO limits(id,count,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(key,Date.now()+60000).first<{count:number}>();if((count?.count||0)>5)throw Error('잠시 후 다시 시도해주세요.');
 const code=Array.from(crypto.getRandomValues(new Uint8Array(9))).map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();const expires=Date.now()+300000;
 const result=await database().prepare('INSERT INTO kakao_links(team,member,code_hash,expires) VALUES (?,?,?,?) ON CONFLICT(team,member) DO UPDATE SET code_hash=excluded.code_hash,expires=excluded.expires WHERE kakao_links.sender IS NULL').bind(teamId,member,await kakaoHash(code),expires).run();
 if(!result.meta.changes)throw Error('이미 카톡 계정이 연결되어 있습니다.');return {code,expires};
}
export async function bridgeSnapshot(origin:string,p:any){
 const row=await read();if(!row)throw Error('팀이 없습니다.');
 const integer=(v:any)=>Number.isSafeInteger(v)&&v>=0&&v<=10000?v:0;
 await database().prepare('INSERT INTO kakao_health(team,checked_at,iris_ready,pending,uncertain) VALUES (?,?,?,?,?) ON CONFLICT(team) DO UPDATE SET checked_at=excluded.checked_at,iris_ready=excluded.iris_ready,pending=excluded.pending,uncertain=excluded.uncertain').bind(team(),Date.now(),p.irisReady===true?1:0,integer(p.pending),integer(p.uncertain)).run();
 const state:TeamState=JSON.parse(row.state);
 return {version:row.version,events:publishedTrainings(state).map(e=>trainingSummary(state,e,origin))};
}
const help='[아크로바틱 / ACROBATIC]\n앱 → 팀 설정 → 카카오톡 연결에서 코드를 발급한 뒤 !연결 코드 / !link CODE\n!참석 날짜 / !yes DATE\n!불참 날짜 / !no DATE\n!미정 날짜 / !maybe DATE\n!현황 날짜 / !status DATE\n!가이드 날짜 / !guide DATE\n예 / e.g. !참석 2026-11-02\n앱과 같은 참석 예정 기록을 사용합니다. / Synced with app RSVPs.';
export async function bridgeMessage(origin:string,p:any){
 for(const key of ['id','room','sender','text'])if(typeof p[key]!=='string'||!p[key]||p[key].length>({id:100,room:30,sender:30,text:300}[key]||300))throw Error('Invalid bridge message.');
 if(p.room!==env.KAKAO_ROOM_ID||!/^\d{1,30}$/.test(p.sender))throw Error('허용되지 않은 채팅방 또는 계정입니다.');
 const receiptId=await kakaoHash(p.room+':'+p.id);const sender=await kakaoHash(p.room+':'+p.sender);
 const previous=await database().prepare('SELECT reply FROM kakao_receipts WHERE team=? AND id=?').bind(team(),receiptId).first<{reply:string}>();if(previous)return {reply:previous.reply,duplicate:true};
 const command=parseKakaoCommand(p.text);if(!command)return {reply:''};if(command.kind==='help')return {reply:help};
 if(command.kind==='link'){
  const codeHash=await kakaoHash(command.code);const link=await database().prepare('SELECT member FROM kakao_links WHERE team=? AND code_hash=? AND expires>? AND sender IS NULL').bind(team(),codeHash,Date.now()).first<{member:string}>();
  const row=await read();const state:TeamState|undefined=row?JSON.parse(row.state):undefined;
  if(!link||!await enabled(link.member)||!state?.members.some(m=>m.id===link.member&&m.active!==false))return {reply:'연결 코드가 만료되었거나 유효하지 않아. 앱에서 다시 발급해줘. / Link code expired or invalid. Generate a new code in the app.'};
  const reply='카톡 계정 연결 완료. 이제 !참석 날짜로 응답할 수 있어. / Account linked. Use !yes DATE to RSVP.';
  try{
   const result=await database().batch([
    database().prepare('UPDATE kakao_links SET sender=?,code_hash=NULL,expires=0 WHERE team=? AND member=? AND code_hash=? AND expires>? AND sender IS NULL').bind(sender,team(),link.member,codeHash,Date.now()),
    database().prepare('INSERT OR IGNORE INTO kakao_receipts(team,id,commit_id,reply,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM kakao_links WHERE team=? AND member=? AND sender=?)').bind(team(),receiptId,crypto.randomUUID(),reply,Date.now(),team(),link.member,sender)
   ]);return {reply:result[1].meta.changes?reply:'연결 상태가 변경되었어. 앱에서 확인해줘. / Check your account link in the app.'};
  }catch{return {reply:'이미 연결된 카톡 계정이야. 앱에서 연결을 해제한 뒤 다시 시도해줘. / This Kakao account is already linked.'};}
 }
 const link=await database().prepare('SELECT member FROM kakao_links WHERE team=? AND sender=?').bind(team(),sender).first<{member:string}>();
 if(!link||!await enabled(link.member))return {reply:'먼저 앱 → 팀 설정에서 카톡 계정을 연결해줘. / Link your Kakao account in app settings first.'};
 for(let attempt=0;attempt<5;attempt++){
  const row=await read();if(!row)throw Error('팀이 없습니다.');const state:TeamState=JSON.parse(row.state);
  if(!state.members.some(m=>m.id===link.member&&m.active!==false))return {reply:'활동 중인 부원만 응답할 수 있어. / Active members only.'};
  let event;try{event=selectKakaoTraining(state,command.selector);}catch(e){return {reply:(e as Error).message};}
  if(command.kind!=='rsvp')return {reply:trainingSummary(state,event,origin)[command.kind==='guide'?'guide':'attendance']};
  const next=mutate(state,link.member,'attendance',{event:event.id,member:link.member,value:command.value});
  const reply=trainingSummary(next,next.events.find(e=>e.id===event.id)!,origin).attendance;const commit=crypto.randomUUID();
  const result=await database().batch([
   database().prepare('INSERT INTO kakao_receipts(team,id,commit_id,reply,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM teams WHERE id=? AND version=?) AND NOT EXISTS(SELECT 1 FROM kakao_receipts WHERE team=? AND id=?)').bind(team(),receiptId,commit,reply,Date.now(),team(),row.version,team(),receiptId),
   database().prepare('UPDATE teams SET state=?,version=version+1 WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM kakao_receipts WHERE team=? AND id=? AND commit_id=?)').bind(JSON.stringify(next),team(),row.version,team(),receiptId,commit)
  ]);
  if(result[1].meta.changes)return {reply};
  const done=await database().prepare('SELECT reply FROM kakao_receipts WHERE team=? AND id=?').bind(team(),receiptId).first<{reply:string}>();if(done)return {reply:done.reply,duplicate:true};
 }
 throw Error('동시에 저장 중입니다. 다시 시도해주세요.');
}
