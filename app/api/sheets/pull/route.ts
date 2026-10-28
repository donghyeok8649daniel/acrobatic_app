import {env} from 'cloudflare:workers';
import {teamContext,response,validOrigin} from '../../../../lib/server-team';
import {equalSecret} from '../../../../lib/password';
import {pullPublicSheet} from '../../../../lib/server-sheet-pull';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{if(!validOrigin(req))return response({error:'허용되지 않는 요청입니다.'},403);const trusted=!!env.SHEET_SYNC_TOKEN&&equalSecret(req.headers.get('authorization')||'','Bearer '+env.SHEET_SYNC_TOKEN);if(!trusted){const auth=await teamContext(req);if(!auth)return response({error:'로그인이 필요합니다.'},401);const config=JSON.parse(env.SHEET_SYNC_CONFIG||'{}');if(auth.me.role!=='captain'||auth.team!==config.teamId)return response({error:'동장만 수동 동기화할 수 있습니다.'},403);}return response(await pullPublicSheet());}catch(error){const message=error instanceof Error?error.message:'';return response({error:/D1|SQL|database|constraint/i.test(message)?'시트를 반영하지 못했습니다.':message||'시트 연결을 확인해주세요.'},409);}}
