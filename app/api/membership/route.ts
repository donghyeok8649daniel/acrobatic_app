import {env} from 'cloudflare:workers';
import {database,response,teamContext,updateTeam,validOrigin} from '../../../lib/server-team';
import {normalizeEmail,isKaistEmail,passwordHash} from '../../../lib/password';
import {roleNames} from '../../../lib/domain';
export const dynamic='force-dynamic';
export async function GET(req:Request){const auth=await teamContext(req);if(!auth)return response({error:'로그인이 필요합니다.'},401);if(auth.me.role!=='captain')return response({error:'동장만 가입 신청을 확인할 수 있습니다.'},403);const {results}=await database().prepare('SELECT id,email,details,requested_at FROM membership_requests WHERE team=? AND status=? ORDER BY requested_at').bind(auth.team,'pending').all();return response({requests:results.map((r:any)=>({...JSON.parse(r.details),id:r.id,requestedAt:r.requested_at}))});}
export async function POST(req:Request){try{
 if(!validOrigin(req))return response({error:'허용되지 않는 요청입니다.'},403);const raw=await req.text();if(raw.length>6000)return response({error:'입력이 너무 큽니다.'},413);const body=JSON.parse(raw);
 if(body.action==='request'){
  const config=JSON.parse(env.SHEET_SYNC_CONFIG||'{}');if(!config.teamId)throw Error('가입 신청 연결이 필요합니다.');
  const ip=req.headers.get('cf-connecting-ip')||'local';const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+Math.floor(Date.now()/3600000))))).map(v=>v.toString(16).padStart(2,'0')).join('');const limit=await database().prepare('INSERT INTO limits(id,count,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind('join:'+hash,Date.now()+3600000).first<{count:number}>();if((limit?.count||0)>5)throw Error('신청 시도가 많습니다. 잠시 후 다시 시도해주세요.');
  const email=normalizeEmail(body.email),name=typeof body.name==='string'?body.name.trim():'';if(!isKaistEmail(email)||!/^\d{8}$/.test(body.studentNumber||'')||!name||name.length>30)throw Error('이름, KAIST 이메일, 8자리 학번을 확인해주세요.');
  const positions=['공격수','세터','수비','미정','운영'];if(!positions.includes(body.position)||!['left','right','both','unknown'].includes(body.dominantFoot)||!['학부생','교환학생','대학원생','기타'].includes(body.membershipType))throw Error('가입 정보를 확인해주세요.');
  const details={name,email,studentNumber:body.studentNumber,position:body.position,dominantFoot:body.dominantFoot,membershipType:body.membershipType};
  await database().prepare('INSERT INTO membership_requests(id,team,email,details,status,requested_at) VALUES (?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(crypto.randomUUID(),config.teamId,email,JSON.stringify(details),'pending',Date.now()).run();return response({ok:true});
 }
 const auth=await teamContext(req);if(!auth)return response({error:'로그인이 필요합니다.'},401);if(auth.me.role!=='captain')return response({error:'동장만 승인할 수 있습니다.'},403);
 const row=await database().prepare('SELECT details,status FROM membership_requests WHERE id=? AND team=?').bind(String(body.id||''),auth.team).first<{details:string;status:string}>();if(!row)throw Error('가입 신청을 찾을 수 없습니다.');if(row.status!=='pending')return response({ok:true});
 if(body.action==='reject'){await database().prepare('UPDATE membership_requests SET status=? WHERE id=? AND team=?').bind('rejected',body.id,auth.team).run();return response({ok:true});}
 if(body.action!=='approve'||!['player','manager','assistant'].includes(body.role))throw Error('승인 정보를 확인해주세요.');
 const p=JSON.parse(row.details);if(auth.state.members.some(m=>m.name.toLowerCase()===p.name.toLowerCase()||m.sheetProfile?.email===p.email||m.email===p.email))throw Error('이미 가입된 부원입니다.');const old=(auth.state.archivedMembers||[]).find(m=>m.name.toLowerCase()===p.name.toLowerCase()||m.sheetProfile?.email===p.email),memberId=old?.id||'join-'+body.id;
 const existing=await database().prepare('SELECT member FROM email_accounts WHERE email=?').bind(p.email).first<{member:string}>();if(existing&&existing.member!==memberId)throw Error('이미 등록된 이메일입니다.');
 const hash=await passwordHash(p.studentNumber,env.AUTH_PEPPER||'');
 await updateTeam(auth.team,s=>{if(s.members.some(m=>m.id===memberId))return s;const profile={...old,id:memberId,name:p.name,role:body.role,office:roleNames[body.role as keyof typeof roleNames],number:old?.number??null,position:body.role==='manager'?'운영':p.position,secondaryPosition:'',status:'활동 중',active:true,membershipType:p.membershipType,dominantFoot:p.dominantFoot,keepInApp:true,email:p.email,studentNumber:p.studentNumber};
   if(body.includeInSheet===true){const y=new Date().getUTCFullYear(),semester=String(y).slice(2)+'년 '+(Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',month:'numeric'}).format(new Date()))>=8?'가을학기':'봄학기');profile.sheetProfile={id:'app-'+body.id,semester,joinedSemester:semester,generation:'',studentNumber:p.studentNumber,name:p.name,office:profile.office,position:profile.position,secondaryPosition:'',email:p.email};}
   else delete profile.sheetProfile;
   s.members.push(profile);s.archivedMembers=s.archivedMembers?.filter(m=>m.id!==memberId);return s;});
 await database().prepare('INSERT INTO email_accounts(email,team,member,password,must_change,enabled) VALUES (?,?,?,?,1,1) ON CONFLICT(team,member) DO UPDATE SET email=excluded.email,enabled=1').bind(p.email,auth.team,memberId,hash).run();
 await database().prepare('UPDATE membership_requests SET status=? WHERE id=? AND team=?').bind('approved',body.id,auth.team).run();return response({ok:true});
 }catch(err){const msg=err instanceof Error?err.message:'';return response({error:/D1|SQL|constraint|database/i.test(msg)?'가입 정보를 저장하지 못했습니다.':msg||'가입 정보를 확인해주세요.'},400);}}
