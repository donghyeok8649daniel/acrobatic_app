import assert from 'node:assert/strict';
import {verifyMatchCancellation} from './verify-match-cancellation.mjs';
const origin=process.env.ACRO_ORIGIN;
assert.ok(origin,'ACRO_ORIGIN must point to a disposable local Worker');
async function post(action,payload={},cookie=''){
 const response=await fetch(origin+'/api/team',{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(20000)});
 return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
console.log('Checking member and position-leader lifecycle');
const created=await post('create',{name:'팀장 변경 검증',captain:'테스트 동장'});
assert.equal(created.status,200);const captain=created.cookie;
const assistant=await post('login',{teamId:created.data.teamId,code:created.data.codes.find(v=>v.memberId==='m3').code});
assert.equal(assistant.status,200);
async function state(){const response=await fetch(origin+'/api/team',{headers:{cookie:captain},signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);return (await response.json()).state;}
async function edit(id,patch){const member=(await state()).members.find(v=>v.id===id);const response=await post('member',{...member,...patch},captain);assert.equal(response.status,200,JSON.stringify(response.data));return response.data.state;}
async function assign(group,member){const response=await post('positionLeader',{group,member},captain);assert.equal(response.status,200);return response.data.state;}
await edit('m3',{position:'공격수',secondaryPosition:'세터'});
await edit('m4',{position:'수비',secondaryPosition:'미정'});
await assign('attack','m3');await assign('setter','m3');await assign('defense','m4');

// Moving a matching position from primary to secondary retains eligibility.
let current=await edit('m3',{position:'수비',secondaryPosition:'공격수'});
assert.deepEqual(current.positionLeaders,{attack:'m3',defense:'m4'});
current=await edit('m3',{position:'세터',secondaryPosition:''});
assert.deepEqual(current.positionLeaders,{defense:'m4'});
await assign('setter','m3');

// A rejected partial profile change cannot leave partially updated leaders.
const before=await state();
assert.equal((await post('member',{...before.members.find(v=>v.id==='m3'),position:''},captain)).status,400);
assert.deepEqual(await state(),before);

// Role changes through setup must clear the leader and apply permissions to
// already-issued sessions, rather than requiring a logout to take effect.
const managerSetup=await state();managerSetup.members.find(v=>v.id==='m3').role='manager';
let result=await post('setup',managerSetup,captain);assert.equal(result.status,200);
assert.deepEqual(result.data.state.positionLeaders,{defense:'m4'});
assert.equal((await post('positionLeader',{group:'setter',member:'m3'},captain)).status,400);
const playerSetup=await state();playerSetup.members.find(v=>v.id==='m3').role='player';
result=await post('setup',playerSetup,captain);assert.equal(result.status,200);
assert.equal((await post('notice',{title:'차단 검증',body:'기존 세션 권한 변경'},assistant.cookie)).status,400);
assert.equal((await post('positionLeader',{group:'defense',member:'m4'},assistant.cookie)).status,400);

// Membership removal is deliberately unsupported: both entry points reject
// it and preserve the member, position leader, and existing records.
await assign('setter','m3');const preserved=await state();
const missingMember=structuredClone(preserved);missingMember.members=missingMember.members.filter(v=>v.id!=='m3');
assert.equal((await post('setup',missingMember,captain)).status,400);
assert.deepEqual(await state(),preserved);
assert.equal((await post('delete',{collection:'members',id:'m3'},captain)).status,400);
assert.deepEqual(await state(),preserved);

// Returning home clears current leadership. Reactivation does not silently
// appoint a new leader or restore an old assignment.
current=await edit('m3',{status:'귀국'});assert.deepEqual(current.positionLeaders,{defense:'m4'});
assert.equal((await post('positionLeader',{group:'setter',member:'m3'},captain)).status,400);
current=await edit('m3',{status:'활동 중',active:true});assert.deepEqual(current.positionLeaders,{defense:'m4'});
console.log('PASS: primary/secondary position removal, role changes and live session permissions, rejected membership removal, return/reactivation leadership lifecycle');

// Role/status changes must also remove ineligible players from upcoming match
// selections, while preserving past match history and attendance records.
const fixtures=[];
for(const date of ['2000-11-02','2099-11-02']){
 result=await post('event',{title:'엔트리 변경 검증',kind:'친선 경기',date,time:'18:30',location:'테스트 코트'},captain);
 assert.equal(result.status,200);const event=result.data.state.events.find(v=>v.date===date).id;fixtures.push(event);
 for(const member of ['m3','m4']){
  assert.equal((await post('attendance',{event,member,value:'참석'},captain)).status,200);
  assert.equal((await post('matchEntry',{event,member},captain)).status,200);
 }
 for(const [slot,member] of [['setter','m3'],['left','m4']])assert.equal((await post('matchBest4',{event,slot,member},captain)).status,200);
}
assert.equal((await post('lineup',{slot:'setter',member:'m3'},captain)).status,200);
await assign('setter','m3');
const roleChange=await state();roleChange.members.find(v=>v.id==='m3').role='manager';
result=await post('setup',roleChange,captain);assert.equal(result.status,200);current=result.data.state;
const past=current.events.find(v=>v.id===fixtures[0]);
let upcoming=current.events.find(v=>v.id===fixtures[1]);
assert.deepEqual(past.entryIds,['m3','m4']);assert.equal(past.best4.setter,'m3');
assert.deepEqual(upcoming.entryIds,['m4']);assert.deepEqual(upcoming.best4,{left:'m4'});
assert.equal(upcoming.attendance.m3,'참석');assert.equal(current.lineup.setter,undefined);assert.equal(current.positionLeaders.setter,undefined);
assert.equal((await post('matchEntry',{event:fixtures[1],member:'m3'},captain)).status,400);
assert.equal((await post('matchBest4',{event:fixtures[0],slot:'attack',member:'m3'},captain)).status,400);
assert.equal((await post('lineup',{slot:'attack',member:'m3'},captain)).status,400);
current=await edit('m4',{status:'귀국'});upcoming=current.events.find(v=>v.id===fixtures[1]);
assert.deepEqual(upcoming.entryIds,[]);assert.deepEqual(upcoming.best4,{});
assert.deepEqual(current.events.find(v=>v.id===fixtures[0]),past);
assert.equal((await post('matchEntry',{event:fixtures[1],member:'m4'},captain)).status,400);
assert.equal((await post('lineup',{slot:'left',member:'m4'},captain)).status,400);
current=await edit('m4',{status:'활동 중',active:true});
assert.deepEqual(current.events.find(v=>v.id===fixtures[1]).entryIds,[]);
assert.deepEqual(current.events.find(v=>v.id===fixtures[1]).best4,{});
console.log('PASS: role/return changes clear future match rosters, BEST 4 and current lineup; past matches and attendance are preserved; reactivation never auto-selects players');
const attendee=await post('login',{teamId:created.data.teamId,code:created.data.codes.find(v=>v.memberId==='m4').code});assert.equal(attendee.status,200);
await verifyMatchCancellation({post,state,captain,manager:assistant.cookie,player:attendee.cookie});
