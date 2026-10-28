import type {Member} from './domain';
export const positionOptions=['미정','공격수','세터','수비','좌수비','우수비','멀티','운영'];
export function isPlayingMember(member:Member|undefined):boolean{return !!member&&member.role!=='manager'&&member.active!==false&&!['귀국','탈퇴','활동 중단','비활동','휴식 중'].includes(member.status);}
export function positionLabel(m:Member){return m.position+(m.secondaryPosition&&m.secondaryPosition!==m.position&&m.secondaryPosition!=='미정'?' · 부 '+m.secondaryPosition:'');}
export function positionSearch(m:Member){return [m.name,m.position,m.secondaryPosition,m.positionNote].filter(Boolean).join(' ');}
export function positionRank(m:Member,slot:string){const target=slot==='attack'?'공격수':slot==='setter'?'세터':'수비';const normalize=(p?:string)=>p==='공격'?'공격수':['좌수비','우수비'].includes(p||'')?'수비':p;if(normalize(m.position)===target)return 0;if(normalize(m.secondaryPosition)===target)return 1;return 2;}
