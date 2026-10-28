import type {Member} from './domain';
export function socialGroup(member:Member){if(member.socialGroup)return member.socialGroup;if(member.role==='manager')return '';return member.position==='공격'||member.position==='공격수'?'attack':member.position==='세터'?'setter':['수비','좌수비','우수비'].includes(member.position)?'defense':'';}
