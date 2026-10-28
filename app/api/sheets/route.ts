import {env} from 'cloudflare:workers';
import {database,response,teamContext,validOrigin} from '../../../lib/server-team';
import {sheetConfig,syncAccounts} from '../../../lib/server-sheets';
import {equalSecret} from '../../../lib/password';
import {validateSnapshot,snapshotOf,mergeSnapshots,applySnapshot} from '../../../lib/sheet-sync';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const auth=await teamContext(req);if(!auth)return response({error:'로그인이 필요합니다.'},401);if(auth.me.role!=='captain')return response({error:'동장만 연결 설정을 볼 수 있습니다.'},403);const config=sheetConfig();if(config.teamId!==auth.team)return response({error:'연결된 팀이 아닙니다.'},403);return response({spreadsheetUrl:`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`,lastSynced:auth.state.sheetSync?.lastSynced||null,mode:config.pullEnabled?'public-read':auth.state.sheetSync?.mode||'manual',pendingWrites:auth.state.sheetSync?.pendingWrites||false,lastError:auth.state.sheetSync?.lastError||'',connected:auth.state.sheetSync?.connected||false});}catch{return response({error:'시트 연결 설정을 확인해주세요.'},503);}}
export async function POST(req:Request){try{
 if(!validOrigin(req))return response({error:'허용되지 않는 요청입니다.'},403);
 if(!env.SHEET_SYNC_TOKEN||!equalSecret(req.headers.get('authorization')||'','Bearer '+env.SHEET_SYNC_TOKEN))return response({error:'인증이 필요합니다.'},401);
 const length=Number(req.headers.get('content-length')||0);if(length>1500000)return response({error:'입력이 너무 큽니다.'},413);
 const raw=await req.text();if(raw.length>1500000)return response({error:'입력이 너무 큽니다.'},413);const body=JSON.parse(raw),config=sheetConfig();
 if(body.spreadsheetId!==config.spreadsheetId)return response({error:'연결된 시트가 아닙니다.'},403);
 if(body.protocolVersion!==2)return response({error:'앱 설정에서 최신 시트 연동 스크립트를 다시 설치해주세요.'},409);
 const incoming=validateSnapshot(body.snapshot);let saved;
 for(let attempt=0;attempt<4;attempt++){
  const row=await database().prepare('SELECT state,version FROM teams WHERE id=?').bind(config.teamId).first<{state:string;version:number}>();if(!row)throw Error('팀이 없습니다.');
  const original=JSON.parse(row.state);
  const stored=await database().prepare('SELECT baseline FROM sheet_links WHERE team=?').bind(config.teamId).first<{baseline:string}>();
  const base=body.base?validateSnapshot(body.base):stored?validateSnapshot(JSON.parse(stored.baseline)):snapshotOf(original);
  const merged=stored||body.base?mergeSnapshots(base,snapshotOf(original),incoming):incoming;
  const state=applySnapshot(original,merged);state.sheetSync={lastSynced:new Date().toISOString(),connected:body.bootstrap!==true};
  const serialized=JSON.stringify(state);if(serialized.length>750000)throw Error('팀 기록 용량을 초과했습니다.');
  const result=await database().prepare('UPDATE teams SET state=?,version=version+1 WHERE id=? AND version=?').bind(serialized,config.teamId,row.version).run();
  if(!result.meta.changes)continue;
  await syncAccounts(state,config.teamId);
  await database().prepare('INSERT INTO sheet_links(team,baseline) VALUES (?,?) ON CONFLICT(team) DO NOTHING').bind(config.teamId,JSON.stringify(merged)).run();
  saved=merged;break;
 }
 if(!saved)return response({error:'다른 팀원이 수정 중입니다. 다시 동기화해주세요.'},409);
 return response({snapshot:saved});
 }catch(error){const message=error instanceof Error?error.message:'';return response({error:/D1|SQL|constraint|database/i.test(message)?'시트 저장 중 오류가 발생했습니다.':message||'시트를 동기화하지 못했습니다.'},message.startsWith('동기화 충돌')?409:400);}}
