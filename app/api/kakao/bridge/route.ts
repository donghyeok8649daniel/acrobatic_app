import {bridgeAuthorized,bridgeMessage,bridgeSnapshot} from '../../../../lib/server-kakao';
import {response} from '../../../../lib/server-team';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(!await bridgeAuthorized(req))return response({error:'Bridge unavailable or unauthorized.'},401);
 try{
  if(!req.headers.get('content-type')?.includes('application/json'))return response({error:'JSON required.'},415);
  const raw=await req.text();if(raw.length>2500)return response({error:'Payload too large.'},413);const p=JSON.parse(raw);
  if(p.action==='snapshot')return response(await bridgeSnapshot(new URL(req.url).origin,p));
  if(p.action==='message')return response(await bridgeMessage(new URL(req.url).origin,p));
  return response({error:'Unknown action.'},400);
 }catch(e){return response({error:e instanceof Error&&!/D1|SQL|constraint|database/i.test(e.message)?e.message:'Bridge storage unavailable.'},503);}
}
