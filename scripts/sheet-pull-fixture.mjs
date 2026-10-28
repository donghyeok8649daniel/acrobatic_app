import {initialState} from '../lib/domain.ts';
import {snapshotOf} from '../lib/sheet-sync.ts';
export function pullFixture(){
 const state=initialState('CSV test','Captain');state.members=[state.members[0],{...state.members[3],name:'Player'}];
 for(const [i,m] of state.members.entries())m.sheetProfile={id:'r'+m.id,semester:'test',joinedSemester:'test',generation:'1',studentNumber:'2099000'+(i+1),name:m.name,office:i?'선수':'동장/주장',position:m.position,secondaryPosition:'',email:i?'player@kaist.ac.kr':'captain@kaist.ac.kr'};
 state.sheetLedger=[{id:'l1',semester:'test',title:'Equipment',date:'2026-10-28',amount:-1000,unitPrice:null,quantity:null,receipt:''}];state.meetingMinutes=[];state.rollcall=[];state.duesRecords=[];
 const baseline=snapshotOf(state);state.meetingMinutes=[{id:'app-note',date:'2026-10-28',category:'운영',title:'App note',body:'Keep this'}];
 const rows={1:[['semester','joined','generation','student','name','office','position','secondary','email'],...baseline.roster.map(r=>[r.semester,r.joinedSemester,r.generation,r.studentNumber,r.name,r.office,r.position,r.secondaryPosition,r.email]),['test','test','1','20990003','Applicant','선수','수비','','applicant@kaist.ac.kr']],2:[['semester','title','date','amount','unit','qty','receipt','id'],['test','Equipment','2026. 10. 28.','-2000','','','','l1'],['test','New expense','2026-10-28','-500','','','','new-expense']],3:[['date','category','title','body','id'],['2026-10-28','운영','Sheet note','New from sheet','sheet-note']],4:[['semester','student','name','office','expected','paid','confirmed','date','note','id'],['test','20990001','Captain','동장/주장','30000','30000','TRUE','','','d1']]};
 const csv=Object.fromEntries(Object.entries(rows).map(([id,values])=>[id,values.map(r=>r.map(c=>'"'+c.replaceAll('"','""')+'"').join(',')).join('\r\n')]));
 return {state,baseline,csv};
}
