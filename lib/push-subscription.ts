export type ClubPushSubscription={endpoint:string;expirationTime:number|null;keys:{p256dh:string;auth:string}};
export function validatePushSubscription(input:any):ClubPushSubscription{
 if(!input||typeof input.endpoint!=='string'||input.endpoint.length>4096)throw Error('알림 구독 정보를 확인해주세요.');
 const url=new URL(input.endpoint);const allowed=url.hostname==='fcm.googleapis.com'||url.hostname==='updates.push.services.mozilla.com'||url.hostname==='web.push.apple.com'||url.hostname.endsWith('.notify.windows.com');
 if(url.protocol!=='https:'||url.username||url.password||url.port||!allowed)throw Error('지원하지 않는 알림 서버입니다.');
 const check=(key:any,size:number)=>{if(typeof key!=='string'||!/^[A-Za-z0-9_-]+$/.test(key))return false;try{return atob(key.replace(/-/g,'+').replace(/_/g,'/')).length===size;}catch{return false;}};
 if(!check(input.keys?.p256dh,65)||!check(input.keys?.auth,16))throw Error('알림 암호화 키를 확인해주세요.');
 return {endpoint:url.href,expirationTime:null,keys:{p256dh:input.keys.p256dh,auth:input.keys.auth}};
}
