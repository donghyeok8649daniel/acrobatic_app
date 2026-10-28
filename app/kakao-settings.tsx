'use client';
import {useEffect,useState} from 'react';
import {useLanguage} from '../lib/i18n';
import type {TeamState} from '../lib/domain';
type Status={configured:boolean;linked:boolean;serverOnline:boolean;irisReady:boolean;pending?:number;uncertain?:number;links?:{member:string}[]};
export function KakaoSettings({state,captain}:{state:TeamState;captain:boolean}){
 const {language}=useLanguage();const en=language==='en';const [status,S]=useState<Status|null>(null),[code,C]=useState(''),[busy,B]=useState(false),[error,E]=useState('');
 async function refresh(){const r=await fetch('/api/kakao');const d:any=await r.json();if(!r.ok)throw Error(d.error);S(d);}
 useEffect(()=>{let stop=false;const read=async()=>{if(stop)return;try{await refresh();}catch{if(!stop)E(en?'Cannot read Kakao connection status.':'카톡 연결 상태를 불러오지 못했어.');}};void read();const timer=setInterval(read,15000);return()=>{stop=true;clearInterval(timer);};},[en]);
 async function action(action:string,member?:string){B(true);E('');try{const r=await fetch('/api/kakao',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,member})});const d:any=await r.json();if(!r.ok)throw Error(d.error);C(d.code||'');await refresh();}catch(e){E((e as Error).message);}finally{B(false);}}
 return <section className="panel form"><h2>{en?'KakaoTalk connection':'카카오톡 연결'}</h2>
 <p>{en?'RSVP in KakaoTalk or the app. Both use the same attendance record.':'카톡과 앱에서 같은 참석 예정 기록을 사용해.'}</p>
 <p role="status">{!status?(en?'Checking…':'확인 중…'):!status.configured?(en?'Bot server setup pending':'봇 서버 연결 대기'):!status.serverOnline?(en?'Bot server offline':'봇 서버 연결 끊김'):!status.irisReady?(en?'KakaoTalk connection needs checking':'카톡 연결 확인 필요'):(en?'Bot server running':'봇 서버 동작 중')}</p>
 {!!status?.uncertain&&<p role="alert">{en?'Some messages need delivery verification.':'전송 여부를 확인해야 하는 메시지가 있어.'} ({status.uncertain})</p>}
 {status?.configured&&(status.linked?<><p>{en?'Your Kakao account is linked.':'내 카톡 계정 연결됨'}</p><button className="btn secondary" disabled={busy} onClick={()=>action('unlink')}>{en?'Unlink my account':'내 카톡 연결 해제'}</button></>:<><button className="btn primary" disabled={busy} onClick={()=>action('createCode')}>{en?'Get a link code':'카톡 연결코드 받기'}</button>{code&&<div className="kakao-link-code"><p>{en?'Within 5 minutes, send this in the club group chat.':'5분 안에 동아리 단톡방에 아래 문장을 보내줘.'}</p><code>!link {code}</code><p>{en?'This code links only your account. It is not your app password.':'내 계정만 연결하는 일회용 코드야.'}</p></div>}</>)}
 <p className="hint">{en?'!yes DATE · !no DATE · !maybe DATE · !status DATE · !guide DATE':'!참석 날짜 · !불참 날짜 · !미정 날짜 · !현황 날짜 · !가이드 날짜'}</p>
 <p className="hint">{en?'Kakao native polls are not synced. The bot records replies and posts current summaries.':'카톡 기본 투표는 연동하지 않아. 봇 명령으로 응답을 받고 최신 현황을 전송해.'}</p>
 {captain&&status?.links?.map(link=><div className="row spread" key={link.member}><span>{state.members.find(m=>m.id===link.member)?.name||link.member}</span><button className="btn small secondary" disabled={busy} onClick={()=>action('unlink',link.member)}>{en?'Unlink':'연결 해제'}</button></div>)}
 {error&&<p role="alert">{error}</p>}</section>;
}
