import {database,response,teamContext,validOrigin} from '../../../lib/server-team';
import {kakaoStatus,makeKakaoLinkCode} from '../../../lib/server-kakao';
export const dynamic='force-dynamic';
export async function GET(req:Request){const auth=await teamContext(req);if(!auth)return response({error:'로그인이 필요합니다.'},401);try{return response(await kakaoStatus(auth.team,auth.member,auth.me.role==='captain'));}catch{return response({error:'카톡 연결 설정을 확인해주세요.'},503);}}
export async function POST(req:Request){
 if(!validOrigin(req))return response({error:'허용되지 않은 요청입니다.'},403);
 const auth=await teamContext(req);if(!auth)return response({error:'로그인이 필요합니다.'},401);
 try{
  const raw=await req.text();if(raw.length>1000)return response({error:'입력이 너무 깁니다.'},413);const p=JSON.parse(raw);
  if(p.action==='createCode')return response(await makeKakaoLinkCode(auth.team,auth.member));
  if(p.action==='unlink'){
   const target=typeof p.member==='string'?p.member:auth.member;if(target!==auth.member&&auth.me.role!=='captain')return response({error:'본인 연결만 해제할 수 있습니다.'},403);
   await database().prepare('DELETE FROM kakao_links WHERE team=? AND member=?').bind(auth.team,target).run();return response({ok:true});
  }
  return response({error:'요청을 확인해주세요.'},400);
 }catch(e){return response({error:e instanceof Error&&!/D1|SQL|constraint|database/i.test(e.message)?e.message:'카톡 연결을 저장하지 못했습니다.'},400);}
}
