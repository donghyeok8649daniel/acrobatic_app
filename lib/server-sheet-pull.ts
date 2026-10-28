import {env} from 'cloudflare:workers';
import {database} from './server-team';
import {syncAccounts} from './server-sheets';
import {validateSnapshot,snapshotOf,mergeSnapshots,applySnapshot} from './sheet-sync';
import {parseCsv,csvSnapshot} from './sheet-csv';
import {isKaistEmail} from './password';
async function readCsv(id:string,gid:number){let url=new URL(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv&gid=${gid}&acro=${Date.now()}`);for(let i=0;i<4;i++){if(url.protocol!=='https:'||!(url.hostname==='docs.google.com'||url.hostname.endsWith('.googleusercontent.com')))throw Error('시트 읽기 주소를 확인해주세요.');const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{'Cache-Control':'no-cache'}});if(r.status>=300&&r.status<400){const next=r.headers.get('location');if(!next)break;url=new URL(next,url);continue;}if(!r.ok)throw Error('현재 시트의 읽기 권한으로 접근할 수 없습니다.');const text=await r.text();if(text.length>500000||text.trimStart().startsWith('<'))throw Error('시트 내용을 읽지 못했습니다.');return parseCsv(text);}throw Error('시트 연결을 확인해주세요.');}
export async function pullPublicSheet(){const config=JSON.parse(env.SHEET_SYNC_CONFIG||'{}');if(!config.pullEnabled||!config.tabs)return {enabled:false};if(!/^[\w-]+$/.test(config.spreadsheetId))throw Error('시트 ID를 확인해주세요.');
 try{const data:Record<string,string[][]>={};for(const kind of ['roster','ledger','minutes','dues']){if(!Number.isSafeInteger(config.tabs[kind]))throw Error('시트 탭 설정이 필요합니다.');data[kind]=await readCsv(config.spreadsheetId,config.tabs[kind]);}
  for(let retry=0;retry<3;retry++){const row=await database().prepare('SELECT state,version FROM teams WHERE id=?').bind(config.teamId).first<{state:string;version:number}>();if(!row)throw Error('팀이 없습니다.');const original=JSON.parse(row.state),current=snapshotOf(original);const old=await database().prepare('SELECT baseline FROM sheet_links WHERE team=?').bind(config.teamId).first<{baseline:string}>();const baseline=old?validateSnapshot(JSON.parse(old.baseline)):current;
   const parsed=csvSnapshot(data,baseline,current);
   // Newly approved app members need a base before the Sheet becomes their
   // metadata source. Unknown Sheet rows only create approval requests.
   for(const member of current.roster)if(!baseline.roster.some(m=>m.id===member.id))baseline.roster.push(member);
   const merged=mergeSnapshots(baseline,current,parsed.snapshot),state=applySnapshot(original,merged);
   const pendingWrites=JSON.stringify(merged)!==JSON.stringify(parsed.snapshot);state.sheetSync={lastSynced:new Date().toISOString(),connected:true,mode:'public-read',pendingWrites};
   const serialized=JSON.stringify(state);if(serialized.length>750000)throw Error('팀 기록 용량을 초과했습니다.');const saved=await database().prepare('UPDATE teams SET state=?,version=version+1 WHERE id=? AND version=?').bind(serialized,config.teamId,row.version).run();if(!saved.meta.changes)continue;
   await syncAccounts(state,config.teamId);
   await database().prepare('INSERT INTO sheet_links(team,baseline) VALUES (?,?) ON CONFLICT(team) DO UPDATE SET baseline=excluded.baseline').bind(config.teamId,JSON.stringify(parsed.snapshot)).run();
   const statements=[];for(const applicant of parsed.pending){if(!isKaistEmail(applicant.email)||!/^\d{8}$/.test(applicant.studentNumber))continue;statements.push(database().prepare('INSERT INTO membership_requests(id,team,email,details,status,requested_at) VALUES (?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(crypto.randomUUID(),config.teamId,applicant.email,JSON.stringify(applicant),'pending',Date.now()));}if(statements.length)await database().batch(statements);
   return {enabled:true,ok:true,pendingWrites,pendingApplicants:parsed.pending.length};
  }throw Error('팀 기록이 수정 중입니다. 다음 동기화에서 다시 시도합니다.');
 }catch(error){const message=error instanceof Error?error.message:'시트 연결 오류';for(let retry=0;retry<2;retry++){const row=await database().prepare('SELECT state,version FROM teams WHERE id=?').bind(config.teamId).first<{state:string;version:number}>();if(!row)break;const state=JSON.parse(row.state);state.sheetSync={...state.sheetSync,lastError:message};const result=await database().prepare('UPDATE teams SET state=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(state),config.teamId,row.version).run();if(result.meta.changes)break;}throw error;}
}
