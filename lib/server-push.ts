import {env} from 'cloudflare:workers';
import {buildPushPayload} from '@block65/webcrypto-web-push';
import {database} from './server-team';
import {validatePushSubscription} from './push-subscription';
export const pushConfigured=()=>!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY);
export async function queueTeamPush(team:string,key:string,url:string){
 if(!pushConfigured())return;
 const message=(en:boolean)=>JSON.stringify({title:en?'KAIST Acrobatic':'KAIST 아크로바틱',body:en?'A new club update is available. Open the app to view it.':'새 동아리 소식이 등록되었습니다. 앱에서 확인하세요.',url,tag:key});
 await database().prepare("INSERT INTO push_jobs(id,endpoint,payload) SELECT ?||p.endpoint,p.endpoint,CASE WHEN p.language='en' THEN ? ELSE ? END FROM push_subscriptions p JOIN email_accounts a ON a.team=p.team AND a.member=p.member WHERE p.team=? AND a.enabled=1 AND a.must_change=0 ON CONFLICT(id) DO NOTHING").bind(team+':'+key+':',message(true),message(false),team).run();
}
export async function dispatchPendingPush(max=12){
 if(!pushConfigured())return {sent:0,failed:0};let sent=0,failed=0;const now=Date.now();
 const {results}=await database().prepare('SELECT j.id,j.endpoint,j.payload,p.subscription FROM push_jobs j JOIN push_subscriptions p ON p.endpoint=j.endpoint JOIN email_accounts a ON a.team=p.team AND a.member=p.member WHERE j.next_at<=? AND j.lease_until<? AND a.enabled=1 AND a.must_change=0 ORDER BY j.next_at,j.id LIMIT ?').bind(now,now,max).all<{id:string;endpoint:string;payload:string;subscription:string}>();
 for(const job of results){const claim=await database().prepare('UPDATE push_jobs SET lease_until=?,attempts=attempts+1 WHERE id=? AND lease_until<? RETURNING attempts').bind(now+60000,job.id,now).first<{attempts:number}>();if(!claim)continue;
  try{const sub=validatePushSubscription(JSON.parse(job.subscription));const request=await buildPushPayload({data:job.payload,options:{ttl:3600}},sub,{subject:env.VAPID_SUBJECT||'https://example.invalid',publicKey:env.VAPID_PUBLIC_KEY!,privateKey:env.VAPID_PRIVATE_KEY!});const r=await fetch(sub.endpoint,{...request,redirect:'manual',signal:AbortSignal.timeout(4000)});if(r.status===404||r.status===410){await database().batch([database().prepare('DELETE FROM push_jobs WHERE endpoint=?').bind(job.endpoint),database().prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(job.endpoint)]);continue;}if(!r.ok)throw Error('Push service rejected delivery');await database().prepare('DELETE FROM push_jobs WHERE id=?').bind(job.id).run();sent++;}
  catch{failed++;if(claim.attempts>=5)await database().prepare('DELETE FROM push_jobs WHERE id=?').bind(job.id).run();else await database().prepare('UPDATE push_jobs SET lease_until=0,next_at=? WHERE id=?').bind(Date.now()+Math.min(3600000,2**claim.attempts*60000),job.id).run();}
 }
 return {sent,failed};
}
export async function notifyAfterMutation(team:string,action:string,p:any,state:any,version:number){if(!['notice','publishTraining','weeklyDiary'].includes(action))return;try{const event=action==='publishTraining'?state.events.find((e:any)=>e.title===p.title&&e.date===p.date):null;await queueTeamPush(team,'v'+version,event?'/?event='+encodeURIComponent(event.id):'/');await dispatchPendingPush(5);}catch{console.warn('Club notification delivery deferred.');}}
