import type {TeamState,Member,Role} from './domain';
import {cleanPositionLeaders} from './member-profile.ts';
import {normalizeEmail,isKaistEmail} from './password.ts';
export type SheetMember={id:string;semester:string;joinedSemester:string;generation:string;studentNumber:string;name:string;office:string;position:string;secondaryPosition:string;email:string};
export type LedgerRecord={id:string;semester:string;title:string;date:string;amount:number|null;unitPrice:number|null;quantity:number|null;receipt:string};
export type MeetingMinute={id:string;date:string;category:string;title:string;body:string};
export type Rollcall={id:string;date:string;semester:string;statuses:Record<string,string>};
export type DuesRecord={id:string;semester:string;studentNumber:string;name:string;office:string;expected:number;paid:number;confirmed:boolean;date:string;note:string};
export type SyncSnapshot={roster:SheetMember[];ledger:LedgerRecord[];minutes:MeetingMinute[];rollcall:Rollcall[];dues:DuesRecord[]};
const list=['roster','ledger','minutes','rollcall','dues'] as const;
const str=(v:any,max=500)=>{if(typeof v!=='string'||v.length>max)throw Error('시트의 문자열을 확인해주세요.');return v.trim();};
const date=(v:any)=>{const d=str(v,10);if(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d))throw Error('시트의 날짜를 확인해주세요.');return d;};
const num=(v:any)=>{if(v===null)return null;if(!Number.isSafeInteger(v)||Math.abs(v)>100000000)throw Error('시트의 금액 또는 수량을 확인해주세요.');return v as number;};
const pos=(v:string)=>v==='공격'?'공격수':v==='매니저'?'운영':v;
export function validateSnapshot(raw:any):SyncSnapshot{
 if(raw&&raw.dues===undefined)raw={...raw,dues:[]};
 if(!raw||list.some(k=>!Array.isArray(raw[k])||raw[k].length>1000))throw Error('시트 데이터 형식을 확인해주세요.');
 const roster:SheetMember[]=raw.roster.map((m:any)=>{const email=normalizeEmail(m.email),studentNumber=str(m.studentNumber,8),position=pos(str(m.position,30)),secondary=pos(str(m.secondaryPosition,30));if(!isKaistEmail(email)||!/^\d{8}$/.test(studentNumber))throw Error('명단의 KAIST 이메일과 8자리 학번을 확인해주세요.');return {id:str(m.id,100),semester:str(m.semester,100),joinedSemester:str(m.joinedSemester,100),generation:str(m.generation,30),studentNumber,name:str(m.name,30),office:str(m.office,50),position,secondaryPosition:secondary===position?'':secondary,email};});
 if(roster.length<1||roster.length>100||new Set(roster.map(m=>m.email)).size!==roster.length||new Set(roster.map(m=>m.studentNumber)).size!==roster.length||new Set(roster.map(m=>m.name)).size!==roster.length)throw Error('명단의 중복 항목을 확인해주세요.');
 const ledger=raw.ledger.map((r:any)=>({id:str(r.id,100),semester:str(r.semester,100),title:str(r.title,150),date:date(r.date),amount:num(r.amount),unitPrice:num(r.unitPrice),quantity:num(r.quantity),receipt:str(r.receipt,1000)}));
 const minutes=raw.minutes.map((r:any)=>({id:str(r.id,100),date:date(r.date),category:str(r.category,100),title:str(r.title,150),body:str(r.body,15000)}));
 const rollcall=raw.rollcall.map((r:any)=>{const statuses:Record<string,string>={};for(const [key,value] of Object.entries(r.statuses||{})){if(!/^\d{8}$/.test(key))throw Error('출석부 학번을 확인해주세요.');const v=str(value,30);if(v)statuses[key]=v;}return {id:str(r.id,100),date:date(r.date),semester:str(r.semester,100),statuses};});
 const dues:DuesRecord[]=raw.dues.map((r:any)=>{const expected=num(r.expected),paid=num(r.paid);if(expected===null||paid===null||expected<0||paid<0||typeof r.confirmed!=='boolean')throw Error('회비 납부 정보를 확인해주세요.');return {id:str(r.id,100),semester:str(r.semester,100),studentNumber:str(r.studentNumber,30),name:str(r.name,30),office:str(r.office,50),expected,paid,confirmed:r.confirmed,date:date(r.date),note:str(r.note,500)};});
 const result:SyncSnapshot={roster,ledger,minutes,rollcall,dues};for(const k of list){if(result[k].some(r=>!r.id)||new Set(result[k].map(r=>r.id)).size!==result[k].length)throw Error('시트 행 ID가 중복되었습니다.');}return result;
}
const same=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
function mergeValue(base:any,app:any,sheet:any,path:string,conflicts:string[]):any{
 if(same(app,sheet))return app;if(same(sheet,base))return app;if(same(app,base))return sheet;
 if(base&&app&&sheet&&typeof base==='object'&&typeof app==='object'&&typeof sheet==='object'&&!Array.isArray(base)){
  const result:any={};for(const key of new Set([...Object.keys(base),...Object.keys(app),...Object.keys(sheet)])){const v=mergeValue(base[key],app[key],sheet[key],path+'.'+key,conflicts);if(v!==undefined)result[key]=v;}return result;
 }
 conflicts.push(path);return app;
}
export function mergeSnapshots(base:SyncSnapshot,app:SyncSnapshot,sheet:SyncSnapshot){
 const conflicts:string[]=[],result:any={};
 for(const key of list){const b=new Map(base[key].map(v=>[v.id,v])),a=new Map(app[key].map(v=>[v.id,v])),s=new Map(sheet[key].map(v=>[v.id,v]));result[key]=[];for(const id of new Set([...s.keys(),...a.keys(),...b.keys()])){const row=mergeValue(b.get(id),a.get(id),s.get(id),key+':'+id,conflicts);if(row!==undefined)result[key].push(row);}}
 if(conflicts.length)throw Error('동기화 충돌: '+conflicts.slice(0,8).join(', ')+'. 양쪽 수정 내용을 확인해주세요.');return validateSnapshot(result);
}
export function snapshotOf(s:TeamState):SyncSnapshot{return {roster:s.members.filter(m=>m.sheetProfile).map(m=>m.sheetProfile!),ledger:s.sheetLedger||[],minutes:s.meetingMinutes||[],rollcall:s.rollcall||[],dues:s.duesRecords||[]};}
export function applySnapshot(current:TeamState,snapshot:SyncSnapshot):TeamState{
 const s=structuredClone(current);const used=new Set<string>();
 const members=snapshot.roster.map(row=>{const old=[...s.members,...(s.archivedMembers||[])].find(m=>m.sheetProfile?.id===row.id||m.sheetProfile?.email===row.email||m.name===row.name);const role:Role=row.office.split(/[\/·,\s]+/).some(v=>['동장','주장','회장'].includes(v))?'captain':/선수/.test(row.office)&&/매니저/.test(row.office)?'assistant':/매니저/.test(row.office)?'manager':row.office==='선수'?'player':old?.role||'player';const id=old?.id||'sheet-'+crypto.randomUUID();used.add(id);return {...old,id,name:row.name,role,number:old?.number??null,position:row.position||'미정',secondaryPosition:row.secondaryPosition,status:old?.status||'활동 중',active:old?.active??true,office:row.office,sheetProfile:row} as Member;});
 for(const member of s.members.filter(m=>m.keepInApp&&!used.has(m.id))){members.push(member);used.add(member.id);}
 const oldCaptain=s.members.find(m=>m.role==='captain');if(members.filter(m=>m.role==='captain').length!==1||oldCaptain&&!members.some(m=>m.id===oldCaptain.id&&m.role==='captain'))throw Error('현재 동장 계정은 명단에 유지해야 합니다.');
 s.archivedMembers=[...(s.archivedMembers||[]),...s.members.filter(m=>!used.has(m.id))].filter((m,i,all)=>!used.has(m.id)&&all.findIndex(v=>v.id===m.id)===i);s.members=members;
 s.duesRecords=snapshot.dues;s.sheetLedger=snapshot.ledger;s.meetingMinutes=snapshot.minutes;s.rollcall=snapshot.rollcall;
 s.transactions=[...s.transactions.filter(t=>!t.id.startsWith('ledger:')),...snapshot.ledger.filter(r=>r.amount!==null&&r.amount!==0).map(r=>({id:'ledger:'+r.id,title:r.title,amount:r.amount!,date:r.date,kind:r.amount!>0?'수입':'지출',member:''}))];
 s.positionLeaders=cleanPositionLeaders(members,s.positionLeaders);for(const slot of Object.keys(s.lineup))if(!used.has(s.lineup[slot]))delete s.lineup[slot];
 for(const e of s.events)if(e.date>=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date())){if(e.entryIds)e.entryIds=e.entryIds.filter(id=>used.has(id));for(const slot of Object.keys(e.best4||{}))if(!used.has(e.best4![slot]))delete e.best4![slot];}
 return s;
}
