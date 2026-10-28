import type {TeamState,Event} from './domain';
import {koreaDate} from './domain.ts';
import {addDays} from './training.ts';

export type KakaoCommand={kind:'link';code:string}|{kind:'rsvp';value:'참석'|'불참'|'미정';selector:string}|{kind:'status'|'guide'|'help';selector:string};
export function parseKakaoCommand(input:string):KakaoCommand|null{
 const [verb,...args]=input.trim().split(/\s+/);const command=verb.toLowerCase();
 if(['!연결','!link'].includes(command))return /^[A-F0-9]{18}$/i.test(args.join(''))?{kind:'link',code:args.join('').toUpperCase()}:null;
 const votes:Record<string,'참석'|'불참'|'미정'>={'!참석':'참석','!불참':'불참','!미정':'미정','!yes':'참석','!no':'불참','!maybe':'미정'};
 if(votes[command]&&args.length<=1)return {kind:'rsvp',value:votes[command],selector:args[0]||''};
 const kinds:Record<string,'status'|'guide'|'help'>={'!현황':'status','!status':'status','!가이드':'guide','!guide':'guide','!도움말':'help','!help':'help'};
 return kinds[command]&&args.length<=1?{kind:kinds[command],selector:args[0]||''}:null;
}
export function publishedTrainings(state:TeamState,today=koreaDate()){
 // Only explicitly published sessions are sent. A recurring schedule alone is not an announcement.
 return state.events.filter(e=>e.kind==='정기 훈련'&&Array.isArray(e.manualIds)&&e.date>=today&&e.date<=addDays(today,90)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
export function selectKakaoTraining(state:TeamState,selector:string,today=koreaDate()):Event{
 const events=publishedTrainings(state,today).filter(e=>!e.cancelled);
 if(selector){const found=events.filter(e=>e.id===selector||e.date===selector);if(found.length===1)return found[0];throw Error('훈련 날짜를 확인해줘. 같은 날 여러 훈련이 있으면 링크의 event ID를 사용해줘. / Check the session date or event ID.');}
 if(events.length===1)return events[0];
 throw Error(events.length?'훈련 날짜를 함께 입력해줘. 예: !참석 2026-11-02 / Include the session date.':'등록된 훈련공지가 없어. / No published training session.');
}
export function trainingSummary(state:TeamState,event:Event,origin:string){
 const members=state.members.filter(m=>m.active!==false);const groups=['참석','불참','미정'].map(value=>({value,names:members.filter(m=>(event.attendance[m.id]||'미정')===value).map(m=>m.name)}));
 const url=new URL('/',origin);url.searchParams.set('event',event.id);
 const manuals=(event.manualIds||[]).flatMap(id=>{const manual=state.trainingManuals?.find(m=>m.id===id);return manual?[{id:manual.id,title:manual.title,titleEn:manual.titleEn||'',steps:manual.steps,stepsEn:manual.stepsEn||''}]:[];});
 const schedule=`${event.date} ${event.time}–${event.endTime||''}\n${event.location}`;
 return {id:event.id,date:event.date,cancelled:!!event.cancelled,url:String(url),
  announcement:`[아크로바틱 / ACROBATIC] ${event.title}${event.cancelled?' · 취소 / Cancelled':''}\n${schedule}\n${event.note||''}\n훈련 / Drills: ${manuals.map(m=>m.title+(m.titleEn?' / '+m.titleEn:'')).join(' · ')||'미정 / TBA'}\n참석투표·가이드 / RSVP & guide\n${url}\n!참석 ${event.date} / !불참 ${event.date} / !미정 ${event.date}\nEnglish: !yes / !no / !maybe + ${event.date}`,
  attendance:`[참석 현황 / RSVP] ${event.title}\n${schedule}\n${groups.map((g,i)=>`${g.value} / ${['Yes','No','Maybe'][i]} ${g.names.length}: ${g.names.join(', ')||'—'}`).join('\n')}\n${url}`,
  guide:`[훈련 가이드 / Training guide] ${event.title}\n${schedule}\n${manuals.map(m=>m.title+(m.titleEn?' / '+m.titleEn:'')+'\n'+m.steps+(m.stepsEn?'\n'+m.stepsEn:'')).join('\n\n').slice(0,5000)}\n모식도·전체 안내 / Diagrams & full guide\n${url}`};
}
