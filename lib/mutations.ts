import {snapshotOf,validateSnapshot,applySnapshot} from './sheet-sync.ts';
import {TeamState,Member,Event,Operations,WeeklyTraining,koreaDate} from './domain';
import {findEvent,recurringEvents} from './training';
import {canLeadPosition,cleanPositionLeaders,positionGroups} from './member-profile';
import {isPlayingMember} from './positions';
const text=(v:any,max=500)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('입력 내용을 확인해주세요.');return v.trim();};
const optional=(v:any,max=1000)=>typeof v==='string'?v.trim().slice(0,max):'';
const validDate=(v:any)=>{const d=text(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d)throw Error('날짜를 확인해주세요.');return d;};
const time=(v:any)=>{if(typeof v!=='string'||!/^\d\d:\d\d$/.test(v)||Number(v.slice(0,2))>23||Number(v.slice(3))>59)throw Error('시간을 확인해주세요.');return v;};
function reconcileMatchSelection(event:Event,players:Set<string>){
 if(event.entryIds)event.entryIds=event.entryIds.filter(id=>players.has(id)&&event.attendance[id]==='참석');
 for(const slot of Object.keys(event.best4||{}))if(!event.entryIds?.includes(event.best4![slot]))delete event.best4![slot];
}
function weekly(value:any):WeeklyTraining[]{if(!Array.isArray(value)||value.length>7)throw Error('정기훈련은 최대 7개까지 등록할 수 있습니다.');return value.map(r=>{const start=time(r.time),end=time(r.endTime);if(end<=start)throw Error('종료 시간은 시작 시간 뒤여야 합니다.');if(!Number.isInteger(r.weekday)||r.weekday<0||r.weekday>6)throw Error('요일을 확인해주세요.');const id=text(r.id,80);if(!/^[\w-]+$/.test(id))throw Error('정기훈련 ID를 확인해주세요.');return {id,weekday:r.weekday,time:start,endTime:end,location:text(r.location,150),startDate:validDate(r.startDate),note:optional(r.note),enabled:r.enabled!==false,exceptions:Array.isArray(r.exceptions)?r.exceptions.map(validDate).slice(0,500):[]};});}
export function validateSetup(p:any,current:TeamState,memberId:string):TeamState{
 if(!Array.isArray(p.members)||p.members.length<1||p.members.length>100)throw Error('명단은 1~100명까지 등록할 수 있습니다.');
 const ids=new Set<string>(),names=new Set<string>();
 const members:Member[]=p.members.map((m:any)=>{const id=text(m.id,80),name=text(m.name,30);if(!/^[\w-]+$/.test(id)||ids.has(id)||names.has(name))throw Error('중복된 이름 또는 잘못된 팀원 ID입니다.');ids.add(id);names.add(name);if(!['captain','manager','assistant','player'].includes(m.role))throw Error('역할을 확인해주세요.');const number=m.number===null||m.number===undefined?null:m.number;if(number!==null&&(!Number.isInteger(number)||number<0||number>99))throw Error('등번호를 확인해주세요.');if(m.departureMonth&&!/^\d{4}-\d{2}$/.test(m.departureMonth))throw Error('귀국 예정 월을 확인해주세요.');return {id,name,role:m.role,number,position:optional(m.position,30)||'미정',secondaryPosition:optional(m.secondaryPosition,30)||'미정',positionNote:optional(m.positionNote,500),status:optional(m.status,30)||'활동 중',note:optional(m.note,500),...(m.departureMonth?{departureMonth:m.departureMonth}:{})};});
 if(members.filter(m=>m.role==='captain').length!==1||members.find(m=>m.id===memberId)?.role!=='captain')throw Error('현재 동장 계정은 유지해야 합니다.');
 if(current.members.some(m=>!ids.has(m.id)))throw Error('기존 팀원의 ID를 제거할 수 없습니다. 활동 상태를 변경해주세요.');
 const op=p.operations;if(!op||!['미정','확정'].includes(op.officerStatus))throw Error('임원진 확정 여부를 확인해주세요.');
 const member=(v:any)=>{if(!ids.has(v))throw Error('담당자 ID를 확인해주세요.');return v;};
 const operations:Operations={stage:text(op.stage,100),officerStatus:op.officerStatus,candidateIds:Array.isArray(op.candidateIds)?[...new Set<string>(op.candidateIds.map(member))]:[],financeOwnerId:member(op.financeOwnerId),equipmentOwnerId:member(op.equipmentOwnerId),seasonGoal:optional(op.seasonGoal,500),trainingExpansion:optional(op.trainingExpansion,500)};
 const fee=p.monthlyFee===null?null:p.monthlyFee;if(fee!==null&&(!Number.isSafeInteger(fee)||fee<0||fee>1000000))throw Error('회비를 확인해주세요.');
 const rules=weekly(p.weeklyTraining||[]).map(r=>({...r,exceptions:[...new Set([...(current.weeklyTraining?.find(old=>old.id===r.id)?.exceptions||[]),...(r.exceptions||[])])]}));
 for(const member of members){const old=current.members.find(v=>v.id===member.id);if(old?.photoRevision)member.photoRevision=old.photoRevision;if(old){member.active=old.active;member.dominantFoot=old.dominantFoot;member.membershipType=old.membershipType;member.socialGroup=old.socialGroup;member.keepInApp=old.keepInApp;member.email=old.email;member.studentNumber=old.studentNumber;member.sheetProfile=old.sheetProfile;member.office=old.office;}}
 return {...current,name:text(p.name,40),description:optional(p.description,150),members,monthlyFee:fee,operations,weeklyTraining:rules,positionLeaders:cleanPositionLeaders(members,current.positionLeaders)};
}
export function mutate(state:TeamState,memberId:string,type:string,p:any):TeamState{
 let s=structuredClone(state);const me=s.members.find(m=>m.id===memberId);if(!me)throw Error('팀원을 찾을 수 없습니다.');const admin=me.role!=='player',captain=me.role==='captain';
 const requireFinance=()=>{if(!admin&&s.financeAccount?.managerId!==memberId)throw Error('동비 관리 담당자만 수정할 수 있습니다.');};
 const requireAdmin=()=>{if(!admin)throw Error('관리 담당자만 수정할 수 있습니다.');};const requireCaptain=()=>{if(!captain)throw Error('동장만 수정할 수 있습니다.');};const id=()=>crypto.randomUUID();
 const member=(v:any,empty=false)=>{if(empty&&!v)return '';if(!s.members.some(m=>m.id===v))throw Error('담당자를 선택해주세요.');return v;};
 const event=(eid:string,includeCancelled=false)=>{const e=findEvent(s,eid);if(!e)throw Error('일정이 없습니다.');if(e.cancelled&&!includeCancelled)throw Error('취소된 경기의 출석과 엔트리는 변경할 수 없습니다.');if(!s.events.some(v=>v.id===eid))s.events.push(e);return s.events.find(v=>v.id===eid)!;};
 const put=(key:'events'|'notices'|'transactions'|'matches'|'tasks'|'equipment'|'trainingSessions',item:any)=>{if(key==='trainingSessions')s.trainingSessions??=[];const list=s[key] as any[];if(p.id){const i=list.findIndex(v=>v.id===p.id);if(i<0)throw Error('수정할 기록이 없습니다.');const old=list[i];list[i]={...old,...item,id:p.id,...(key==='events'?{attendance:old.attendance}:{}),...(key==='tasks'?{done:old.done}:{})};}else if(['notices','matches','tasks','trainingSessions'].includes(key))list.unshift(item);else list.push(item);};
 switch(type){
 case 'duesSemester':{
  requireFinance();const semester=text(p.semester,80);for(const v of [p.playerAmount,p.assistantAmount,p.managerAmount])if(!Number.isSafeInteger(v)||v<0||v>1000000)throw Error('회비 금액을 확인해주세요.');s.duesRecords??=[];if(s.duesRecords.some(r=>r.semester===semester))throw Error('이미 등록된 학기입니다.');
  for(const m of s.members.filter(m=>m.active!==false)){const expected=m.role==='manager'?p.managerAmount:m.role==='assistant'?p.assistantAmount:p.playerAmount;const studentNumber=m.sheetProfile?.studentNumber||m.studentNumber||m.id;s.duesRecords.push({id:'dues:'+crypto.randomUUID(),semester,studentNumber,name:m.name,office:m.office||m.role,expected,paid:0,confirmed:expected===0,date:'',note:expected===0?'회비 면제':''});}break;
 }
 case 'memberRole':{
  requireCaptain();const target=s.members.find(m=>m.id===p.member);if(!target||target.role==='captain'||!['manager','assistant','player'].includes(p.role))throw Error('직책을 확인해주세요.');
  const office=text(p.office,50);if(office.split(/[\/·,\s]+/).some(v=>['동장','주장','회장'].includes(v)))throw Error('동장 인수인계를 사용해주세요.');target.role=p.role;target.office=office;if(target.sheetProfile)target.sheetProfile.office=office;break;
 }
 case 'transferCaptain':{
  requireCaptain();const target=s.members.find(m=>m.id===p.member);if(!target||target.id===memberId||target.active===false||!['assistant','player','manager'].includes(p.previousRole))throw Error('인수인계 대상을 확인해주세요.');
  me.role=p.previousRole;me.office=p.previousRole==='player'?'선수':p.previousRole==='manager'?'매니저장':'선수/매니저';target.role='captain';target.office='동장/주장';
  for(const m of [me,target])if(m.sheetProfile)m.sheetProfile.office=m.office||'';
  s.roleTransfers=[...(s.roleTransfers||[]),{at:new Date().toISOString(),from:me.id,to:target.id}];break;
 }
 case 'financeAccount':{
  requireCaptain();const accountNumber=text(p.accountNumber,40);if(!/^[0-9 -]{5,40}$/.test(accountNumber))throw Error('계좌번호를 확인해주세요.');
  s.financeAccount={bankName:text(p.bankName,40),accountNumber,holder:text(p.holder,50),managerId:member(p.managerId),note:optional(p.note,500)};
  s.financeAccountHistory=[...(s.financeAccountHistory||[]),{at:new Date().toISOString(),actor:memberId,bankName:s.financeAccount.bankName,managerId:s.financeAccount.managerId}].slice(-100);
  if(s.operations)s.operations.financeOwnerId=s.financeAccount.managerId;break;
 }
 case 'trainingManual':{
  requireAdmin();s.trainingManuals??=[];const old=s.trainingManuals.find(v=>v.id===p.id);if(p.id&&!old)throw Error('매뉴얼이 없습니다.');
  if(p.remove){if(s.events.some(e=>e.manualIds?.includes(p.id)))throw Error('훈련공지가 참조하는 매뉴얼은 삭제할 수 없습니다.');s.trainingManuals=s.trainingManuals.filter(v=>v.id!==p.id);break;}
  if(!Number.isInteger(p.minimum)||p.minimum<0||p.minimum>100||!['none','ab','rally'].includes(p.diagram))throw Error('훈련 인원과 모식도를 확인해주세요.');
  const record={id:old?.id||id(),title:text(p.title,100),minimum:p.minimum,goal:optional(p.goal,1000),steps:text(p.steps,10000),titleEn:optional(p.titleEn,100),goalEn:optional(p.goalEn,1000),stepsEn:optional(p.stepsEn,10000),diagram:p.diagram,updatedAt:new Date().toISOString()};
  s.trainingManuals=[...s.trainingManuals.filter(v=>v.id!==record.id),record];break;
 }
 case 'weeklyDiary':{
  requireAdmin();s.weeklyDiaries??=[];const weekStart=validDate(p.weekStart);if(new Date(weekStart+'T12:00:00Z').getUTCDay()!==1)throw Error('해당 주의 월요일 날짜를 선택해주세요.');
  const old=s.weeklyDiaries.find(v=>v.id===p.id);if(p.id&&!old)throw Error('주간 다이어리가 없습니다.');
  const record={id:old?.id||id(),weekStart,title:text(p.title,100),diary:optional(p.diary,10000),timetable:optional(p.timetable,5000),author:old?.author||memberId,updatedAt:new Date().toISOString()};
  s.weeklyDiaries=[...s.weeklyDiaries.filter(v=>v.id!==record.id),record];break;
 }
 case 'publishTraining':{
  requireAdmin();const start=time(p.time),end=time(p.endTime);if(end<=start)throw Error('종료 시간을 확인해주세요.');
  if(!Array.isArray(p.manualIds)||p.manualIds.length>20||p.manualIds.some((v:any)=>typeof v!=='string'||!s.trainingManuals?.some(m=>m.id===v)))throw Error('훈련 매뉴얼을 선택해주세요.');
  const date=validDate(p.date),title=text(p.title,100),location=text(p.location,150),manualIds=[...new Set<string>(p.manualIds)];const existing=recurringEvents(s,date,date).find(e=>!e.cancelled&&e.kind==='정기 훈련'&&e.time===start),eventId=existing?.id||id();
  s.events=s.events.filter(e=>e.id!==eventId);s.events.push({...existing,id:eventId,title,date,time:start,endTime:end,location,kind:'정기 훈련',note:optional(p.note,3000),attendance:existing?.attendance||{},manualIds});
  const names=manualIds.map(v=>s.trainingManuals!.find(m=>m.id===v)!.title).join(' · ');
  s.notices.unshift({id:id(),title:'[훈련] '+title,date:koreaDate(),author:memberId,pinned:false,body:date+' '+start+'~'+end+'\n'+location+'\n'+names+'\n'+optional(p.note,3000)});break;
 }
 case 'sheetRecord':{
  if(['ledger','dues'].includes(p.collection))requireFinance();else requireAdmin();if(!['ledger','minutes','rollcall','dues'].includes(p.collection))throw Error('기록 종류를 확인해주세요.');
  const snapshot=snapshotOf(s);const key=p.collection as 'ledger'|'minutes'|'rollcall'|'dues';const record={...p.record,id:p.record?.id||id()};
  const old=snapshot[key].findIndex(v=>v.id===record.id);
  if(p.remove){if(old<0)throw Error('기록이 없습니다.');snapshot[key].splice(old,1);}else if(old>=0)(snapshot[key] as any[])[old]=record;else (snapshot[key] as any[]).push(record);
  s=applySnapshot(s,validateSnapshot(snapshot));break;
 }
 case 'positionLeader':{requireCaptain();const group=positionGroups.find(v=>v.id===p.group);if(!group)throw Error('포지션을 확인해주세요.');s.positionLeaders??={};if(!p.member){delete s.positionLeaders[group.id];break;}const leader=s.members.find(v=>v.id===p.member);if(!leader||!canLeadPosition(leader,group.id))throw Error('해당 주·세컨 포지션을 가진 선수를 선택해주세요.');s.positionLeaders[group.id]=leader.id;break;}
 case 'setup':requireCaptain();s=validateSetup(p,s,memberId);break;
 case 'attendance':{const e=event(p.event),m=member(p.member||memberId);if(!admin&&m!==memberId)throw Error('본인의 출석만 변경할 수 있습니다.');if(!['참석','불참','미정'].includes(p.value))throw Error('출석을 선택해주세요.');e.attendance[m]=p.value;if(p.value!=='참석'){e.entryIds=e.entryIds?.filter(x=>x!==m);for(const slot of Object.keys(e.best4||{}))if(e.best4![slot]===m)delete e.best4![slot];}break;}
 case 'event':{requireAdmin();const start=time(p.time),end=p.endTime?time(p.endTime):undefined;if(end&&end<=start)throw Error('종료 시간은 시작 시간 뒤여야 합니다.');if(p.id){const old=event(p.id,true);if(old.cancelled&&!['친선 경기','대회'].includes(p.kind))throw Error('취소된 경기는 복원한 뒤 일정 유형을 변경해주세요.');}put('events',{id:id(),title:text(p.title,100),date:validDate(p.date),time:start,endTime:end,location:text(p.location,150),kind:text(p.kind,30),note:optional(p.note),opponent:optional(p.opponent,100),attendance:{}});break;}
 case 'eventCancellation':{
  requireAdmin();const e=event(p.event,true);
  if(!['친선 경기','대회'].includes(e.kind)||e.date<koreaDate())throw Error('예정 경기만 취소하거나 복원할 수 있습니다.');
  if(typeof p.cancelled!=='boolean'||!Number.isSafeInteger(p.expectedVersion)||p.expectedVersion<0)throw Error('경기 상태를 확인해주세요.');
  if(!!e.cancelled===p.cancelled)break;
  if((e.cancellationVersion||0)!==p.expectedVersion)throw Error('다른 팀원이 경기 상태를 변경했어요. 새로고침 후 다시 시도해주세요.');
  if(!p.cancelled)reconcileMatchSelection(e,new Set(s.members.filter(isPlayingMember).map(member=>member.id)));
  e.cancelled=p.cancelled;e.cancellationVersion=(e.cancellationVersion||0)+1;break;
 }
 case 'weeklyTraining':requireCaptain();s.weeklyTraining=weekly(p.rules);break;
 case 'matchEntry':{requireAdmin();const e=event(p.event);if(!['친선 경기','대회'].includes(e.kind))throw Error('경기 일정에서만 엔트리를 편집할 수 있습니다.');const m=member(p.member),entry=new Set(e.entryIds||[]);if(entry.has(m)){entry.delete(m);for(const slot of Object.keys(e.best4||{}))if(e.best4![slot]===m)delete e.best4![slot];}else{if(!isPlayingMember(s.members.find(v=>v.id===m))||e.attendance[m]!=='참석')throw Error('참석하는 선수만 엔트리에 넣을 수 있습니다.');entry.add(m);}e.entryIds=[...entry];break;}
 case 'matchBest4':{requireAdmin();const e=event(p.event);if(!['친선 경기','대회'].includes(e.kind)||!['attack','setter','left','right'].includes(p.slot))throw Error('경기 포지션을 확인해주세요.');if(p.member&&(!isPlayingMember(s.members.find(v=>v.id===p.member))||!e.entryIds?.includes(p.member)||e.attendance[p.member]!=='참석'))throw Error('참석 엔트리에 있는 선수를 선택해주세요.');e.best4??={};for(const slot of Object.keys(e.best4))if(e.best4[slot]===p.member)delete e.best4[slot];if(p.member)e.best4[p.slot]=p.member;else delete e.best4[p.slot];break;}
 case 'notice':requireAdmin();put('notices',{id:id(),title:text(p.title,100),body:text(p.body,3000),pinned:!!p.pinned,date:koreaDate(),author:memberId});break;
 case 'transaction':requireFinance();if(!Number.isSafeInteger(p.amount)||Math.abs(p.amount)>100000000||p.amount===0)throw Error('금액을 확인해주세요.');put('transactions',{id:id(),title:text(p.title,100),date:validDate(p.date),amount:p.amount,kind:text(p.kind,30),member:member(p.member,true)});break;
 case 'match':requireAdmin();if(![p.our,p.their].every(v=>Number.isInteger(v)&&v>=0&&v<=99)||p.our===p.their)throw Error('승패가 있는 세트 스코어를 입력해주세요.');put('matches',{id:id(),opponent:text(p.opponent,100),date:validDate(p.date),our:p.our,their:p.their,note:optional(p.note)});break;
 case 'member':{requireAdmin();const m=s.members.find(m=>m.id===p.id);if(!m)throw Error('팀원이 없습니다.');m.name=text(p.name,30);m.position=text(p.position,30);if(p.secondaryPosition!==undefined)m.secondaryPosition=optional(p.secondaryPosition,30)||'미정';if(p.positionNote!==undefined)m.positionNote=optional(p.positionNote,500);const nextStatus=text(p.status,30);if((nextStatus!==m.status||p.active!==undefined&&p.active!==(m.active??true))&&!captain)throw Error('활동 여부는 동장만 지정할 수 있습니다.');m.status=nextStatus;
 if(p.active!==undefined&&typeof p.active!=='boolean')throw Error('활동 여부를 확인해주세요.');
 m.active=p.active??!['귀국','탈퇴','활동 중단','비활동','휴식 중'].includes(m.status);
 if(p.membershipType!==undefined){if(!captain&&p.membershipType!==(m.membershipType||''))throw Error('회원 유형은 동장만 지정할 수 있습니다.');m.membershipType=optional(p.membershipType,30);}
 if(p.dominantFoot!==undefined){if(!['left','right','both','unknown'].includes(p.dominantFoot))throw Error('주발을 확인해주세요.');m.dominantFoot=p.dominantFoot;}
if(p.number!==null&&(!Number.isInteger(p.number)||p.number<0||p.number>99))throw Error('등번호는 미정 또는 0~99로 입력해주세요.');m.number=p.number;m.note=optional(p.note,500);if(m.secondaryPosition===m.position)m.secondaryPosition='';if(m.sheetProfile)m.sheetProfile={...m.sheetProfile,name:m.name,position:m.position,secondaryPosition:m.secondaryPosition||''};break;}
 case 'task':requireAdmin();put('tasks',{id:id(),title:text(p.title,150),assignee:member(p.assignee),done:false});break;
 case 'taskToggle':{const t=s.tasks.find(t=>t.id===p.id);if(!t)throw Error('할 일이 없습니다.');if(!admin&&t.assignee!==memberId)throw Error('담당자만 완료할 수 있습니다.');t.done=!t.done;break;}
 case 'equipment':requireAdmin();if(!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>9999)throw Error('수량을 확인해주세요.');put('equipment',{id:id(),name:text(p.name,100),quantity:p.quantity,condition:text(p.condition,30),holder:member(p.holder)});break;
 case 'trainingSession':requireAdmin();if(p.eventId&&!findEvent(s,p.eventId))throw Error('연결할 일정이 없습니다.');put('trainingSessions',{id:id(),title:text(p.title,100),date:validDate(p.date),goal:optional(p.goal,1000),drills:optional(p.drills,3000),feedback:optional(p.feedback,3000),author:memberId,...(p.eventId?{eventId:p.eventId}:{})});break;
 case 'lineup':requireAdmin();if(!['attack','setter','left','right'].includes(p.slot))throw Error('포지션을 확인해주세요.');if(p.member&&!isPlayingMember(s.members.find(m=>m.id===p.member)))throw Error('선수를 선택해주세요.');if(p.member)member(p.member);for(const slot of Object.keys(s.lineup))if(s.lineup[slot]===p.member)delete s.lineup[slot];s.lineup[p.slot]=p.member;break;
 case 'settings':requireCaptain();s.name=text(p.name,40);s.description=optional(p.description,150);if(p.monthlyFee!==null&&(!Number.isSafeInteger(p.monthlyFee)||p.monthlyFee<0||p.monthlyFee>1000000))throw Error('회비를 확인해주세요.');s.monthlyFee=p.monthlyFee;break;
 case 'delete':{requireAdmin();if(!['events','notices','transactions','matches','tasks','equipment','trainingSessions'].includes(p.collection))throw Error('삭제할 수 없습니다.');if(p.collection==='events'){const e=findEvent(s,p.id);if(e&&['친선 경기','대회'].includes(e.kind)&&e.date>=koreaDate())throw Error('예정 경기는 삭제 대신 경기 취소를 사용해주세요.');if(e?.recurrenceId){const r=s.weeklyTraining?.find(r=>r.id===e.recurrenceId);if(r)r.exceptions=[...new Set([...(r.exceptions||[]),e.date])];}}if(p.collection==='trainingSessions'&&s.videos?.some(v=>v.sessionId===p.id))throw Error('영상을 먼저 삭제한 뒤 세션을 삭제해주세요.');const key=p.collection as 'events';s[key]=(s[key]||[]).filter((e:any)=>e.id!==p.id) as any;break;}
 default:throw Error('지원하지 않는 작업입니다.');}
 if(['member','setup','memberRole','transferCaptain'].includes(type)){
  s.positionLeaders=cleanPositionLeaders(s.members,s.positionLeaders);
  const players=new Set(s.members.filter(isPlayingMember).map(member=>member.id)),today=koreaDate();
  for(const slot of Object.keys(s.lineup))if(s.lineup[slot]&&!players.has(s.lineup[slot]))delete s.lineup[slot];
  for(const event of s.events){
   // Past match selections are historical records. Only current/upcoming
   // matches follow today's playing eligibility; attendance is kept intact.
   if(event.date<today||!['친선 경기','대회'].includes(event.kind))continue;
   reconcileMatchSelection(event,players);
  }
 }
 if(JSON.stringify(s).length>750000)throw Error('팀 기록 용량을 초과했습니다. 오래된 기록을 내보내고 정리해주세요.');return s;
}
