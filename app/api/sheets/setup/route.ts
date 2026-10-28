import {env} from 'cloudflare:workers';
import {teamContext,response} from '../../../../lib/server-team';
import {sheetConfig} from '../../../../lib/server-sheets';
import {SHEET_BRIDGE_TEMPLATE} from '../../../../lib/sheet-bridge-template';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const auth=await teamContext(req);if(!auth)return response({error:'로그인이 필요합니다.'},401);if(auth.me.role!=='captain')return response({error:'동장만 연결할 수 있습니다.'},403);const config=sheetConfig();if(config.teamId!==auth.team)return response({error:'연결된 팀이 아닙니다.'},403);const script=SHEET_BRIDGE_TEMPLATE.replace('__ACRO_URL__',new URL(req.url).origin).replace('__ACRO_TOKEN__',env.SHEET_SYNC_TOKEN!).replace('__ACRO_SHEET__',config.spreadsheetId);return new Response(script,{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="AcrobaticSync.gs"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch{return response({error:'연결 설정을 확인해주세요.'},503);}}
