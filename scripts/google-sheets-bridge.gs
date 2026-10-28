/** Bound to the club spreadsheet. Download the configured copy from app settings. */
const ACRO_URL='__ACRO_URL__';
const ACRO_TOKEN='__ACRO_TOKEN__';
const ACRO_SHEET='__ACRO_SHEET__';
const ACRO_TABS={roster:'아크로바틱 명단',ledger:'동아리비 사용 내역',minutes:'회의록',rollcall:'출석부',dues:'회비 납부 현황'};
function installAcrobaticSync(){
 const book=SpreadsheetApp.getActiveSpreadsheet();if(book.getId()!==ACRO_SHEET)throw Error('연결된 아크로바틱 시트에서 실행하세요.');
 syncAcrobatic();
 ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='syncAcrobatic').forEach(t=>ScriptApp.deleteTrigger(t));
 ScriptApp.newTrigger('syncAcrobatic').timeBased().everyMinutes(5).create();
 book.toast('5분마다 앱과 명단·동비·회비 납부·회의록을 연동합니다.','아크로바틱',10);
}
function syncAcrobatic(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(30000))return;
 try{
  const book=SpreadsheetApp.getActiveSpreadsheet();if(book.getId()!==ACRO_SHEET)throw Error('시트 ID 불일치');
  const base=acroReadBase_(book),snapshot=acroRead_(book);
  const response=UrlFetchApp.fetch(ACRO_URL+'/api/sheets',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ACRO_TOKEN},payload:JSON.stringify({protocolVersion:2,spreadsheetId:ACRO_SHEET,base,snapshot}),muteHttpExceptions:true});
  const data=JSON.parse(response.getContentText());if(response.getResponseCode()!==200)throw Error(data.error||'앱 동기화 오류');
  // Preserve human edits made while the request was in flight. A conflicting
  // field aborts before writing; it is never silently overwritten.
  const latest=acroRead_(book),merged=acroMerge_(snapshot,data.snapshot,latest);
  acroWrite_(book,merged);acroWriteBase_(book,data.snapshot);
 }finally{lock.releaseLock();}
}
function acroText_(v){return v===null||v===undefined?'':String(v).trim();}
function acroDate_(v){const s=acroText_(v);if(!s)return '';const m=s.match(/^(20\d\d)[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{1,2})\.?$/);if(!m)throw Error('날짜 형식을 확인하세요: '+s);return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');}
function acroNumber_(v){const s=acroText_(v).replace(/[,\s원]/g,'');if(!s)return null;if(!/^-?\d+$/.test(s))throw Error('금액 또는 수량을 확인하세요.');return Number(s);}
function acroPosition_(v){return v==='공격'?'공격수':v==='매니저'?'운영':v;}
function acroIds_(sheet){const result={};sheet.createDeveloperMetadataFinder().withKey('acrobatic.row').find().forEach(m=>{const row=m.getLocation().getRow();if(row)result[row.getRow()]=m.getValue();});return result;}
function acroId_(sheet,row,ids){if(ids[row])return ids[row];let id='gs-'+sheet.getSheetId()+'-'+row;if(Object.values(ids).includes(id))id='gs-'+Utilities.getUuid();sheet.getRange(row,1,1,sheet.getMaxColumns()).addDeveloperMetadata('acrobatic.row',id);ids[row]=id;return id;}
function acroRead_(book){
 const result={roster:[],ledger:[],minutes:[],rollcall:[],dues:[]};
 for(const kind of ['roster','ledger','minutes','dues']){
  const sheet=book.getSheetByName(ACRO_TABS[kind]);if(!sheet)throw Error('시트를 찾을 수 없습니다: '+ACRO_TABS[kind]);
  const width=kind==='roster'?9:kind==='ledger'?7:kind==='dues'?9:4,rows=sheet.getRange(1,1,Math.max(sheet.getLastRow(),1),width).getDisplayValues(),ids=acroIds_(sheet);
  for(let i=1;i<rows.length;i++){const r=rows[i];if(kind==='roster'&&!r[4]||kind==='ledger'&&!r[1]||kind==='dues'&&!r[2]||kind==='minutes'&&(!r[2]||!r[0]&&/^\(/.test(r[2])))continue;const id=acroId_(sheet,i+1,ids);
   if(kind==='roster'){const primary=acroPosition_(r[6]),secondary=acroPosition_(r[7]);result.roster.push({id,semester:r[0],joinedSemester:r[1],generation:r[2],studentNumber:r[3],name:r[4],office:r[5],position:primary,secondaryPosition:secondary===primary?'':secondary,email:r[8].toLowerCase()});}
   else if(kind==='ledger')result.ledger.push({id,semester:r[0],title:r[1],date:acroDate_(r[2]),amount:acroNumber_(r[3]),unitPrice:acroNumber_(r[4]),quantity:acroNumber_(r[5]),receipt:r[6]});
   else if(kind==='dues')result.dues.push({id,semester:r[0],studentNumber:r[1],name:r[2],office:r[3],expected:acroNumber_(r[4])||0,paid:acroNumber_(r[5])||0,confirmed:r[6].toUpperCase()==='TRUE',date:acroDate_(r[7]),note:r[8]});
   else result.minutes.push({id,date:acroDate_(r[0]),category:r[1],title:r[2],body:r[3]});
  }
 }
 const sheet=book.getSheetByName(ACRO_TABS.rollcall);if(!sheet)throw Error('출석부가 없습니다.');
 const rows=sheet.getDataRange().getDisplayValues();for(let col=3;col<(rows[0]||[]).length;col++){if(!rows[0][col])continue;const date=acroDate_(rows[0][col]),statuses={};let semester='';for(let i=1;i<rows.length;i++){if(!/^\d{8}$/.test(rows[i][1]||''))continue;semester=semester||rows[i][0];const value=acroText_(rows[i][col]);if(value)statuses[rows[i][1]]=value;}result.rollcall.push({id:'date:'+date,date,semester,statuses});}
 return result;
}
function acroMerge_(base,app,sheet){
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function value(b,a,s,path){if(same(a,s)||same(s,b))return a;if(same(a,b))return s;if(b&&a&&s&&typeof b==='object'&&typeof a==='object'&&typeof s==='object'&&!Array.isArray(b)){const out={};[...new Set([...Object.keys(b),...Object.keys(a),...Object.keys(s)])].forEach(k=>{const v=value(b[k],a[k],s[k],path+'.'+k);if(v!==undefined)out[k]=v;});return out;}throw Error('동기화 중 시트가 수정되었습니다: '+path);}
 const out={};for(const kind of Object.keys(ACRO_TABS)){base[kind]??=[];app[kind]??=[];sheet[kind]??=[];const b=new Map(base[kind].map(r=>[r.id,r])),a=new Map(app[kind].map(r=>[r.id,r])),s=new Map(sheet[kind].map(r=>[r.id,r]));out[kind]=[];[...new Set([...s.keys(),...a.keys(),...b.keys()])].forEach(id=>{const r=value(b.get(id),a.get(id),s.get(id),kind+':'+id);if(r!==undefined)out[kind].push(r);});}return out;
}
function acroCell_(sheet,row,col,v){const cell=sheet.getRange(row,col),old=cell.getDisplayValue();if(acroText_(old)===acroText_(v))return;if(typeof v==='string'&&/^[=+@]/.test(v))cell.setValue("'"+v);else cell.setValue(v===null?'':v);}
function acroWrite_(book,snapshot){
 for(const kind of ['roster','ledger','minutes','dues']){
  const sheet=book.getSheetByName(ACRO_TABS[kind]),ids=acroIds_(sheet),width=kind==='roster'?9:kind==='ledger'?7:kind==='dues'?9:4,kept=new Set(snapshot[kind].map(r=>r.id));
  for(const [row,id] of Object.entries(ids))if(!kept.has(id)){sheet.getRange(Number(row),1,1,width).clearContent();}
  for(const r of snapshot[kind]){
   let row=Number(Object.keys(ids).find(n=>ids[n]===r.id));if(!row){row=sheet.getLastRow()+1;if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),1);sheet.getRange(row,1,1,sheet.getMaxColumns()).addDeveloperMetadata('acrobatic.row',r.id);ids[row]=r.id;}
   const rawPosition=p=>p==='공격수'?'공격':p==='운영'?'매니저':p;
   const values=kind==='roster'?[r.semester,r.joinedSemester,r.generation,r.studentNumber,r.name,r.office,rawPosition(r.position),rawPosition(r.secondaryPosition),r.email]:kind==='ledger'?[r.semester,r.title,r.date,r.amount,r.unitPrice,r.quantity,r.receipt]:kind==='dues'?[r.semester,r.studentNumber,r.name,r.office,r.expected,r.paid,r.confirmed,r.date,r.note]:[r.date,r.category,r.title,r.body];
   values.forEach((v,i)=>{if(kind==='roster'&&i===7&&!v&&acroPosition_(sheet.getRange(row,8).getDisplayValue())===r.position)return;if((kind==='ledger'&&i===2||kind==='minutes'&&i===0||kind==='dues'&&i===7)&&acroDate_(sheet.getRange(row,i+1).getDisplayValue())===v)return;acroCell_(sheet,row,i+1,v);});
  }
 }
 const sheet=book.getSheetByName(ACRO_TABS.rollcall),data=sheet.getDataRange().getDisplayValues();const people={};for(let i=1;i<data.length;i++)if(/^\d{8}$/.test(data[i][1]||''))people[data[i][1]]=i+1;
 for(const m of snapshot.roster){let row=people[m.studentNumber];if(!row){row=sheet.getLastRow()+1;people[m.studentNumber]=row;}acroCell_(sheet,row,1,m.semester);acroCell_(sheet,row,2,m.studentNumber);acroCell_(sheet,row,3,m.name);}
 const columns={};for(let i=3;i<(data[0]||[]).length;i++)if(data[0][i])columns[acroDate_(data[0][i])]=i+1;
 const dates=new Set(snapshot.rollcall.map(r=>r.date));for(const [date,col] of Object.entries(columns))if(!dates.has(date))sheet.getRange(1,col,sheet.getLastRow(),1).clearContent();
 for(const r of snapshot.rollcall){let col=columns[r.date];if(!col){col=Math.max(3,...Object.values(columns))+1;if(col>sheet.getMaxColumns())sheet.insertColumnsAfter(sheet.getMaxColumns(),col-sheet.getMaxColumns());columns[r.date]=col;acroCell_(sheet,1,col,r.date);}for(const [student,row] of Object.entries(people))acroCell_(sheet,row,col,r.statuses[student]||'');}
}
function acroReadBase_(book){const sheet=book.getSheetByName('_AcrobaticSync');if(!sheet||!sheet.getLastRow())return null;return JSON.parse(sheet.getRange(1,1,sheet.getLastRow(),1).getDisplayValues().map(r=>r[0]).join(''));}
function acroWriteBase_(book,snapshot){let sheet=book.getSheetByName('_AcrobaticSync');if(!sheet){sheet=book.insertSheet('_AcrobaticSync');sheet.hideSheet();}const text=JSON.stringify(snapshot),chunks=[];for(let i=0;i<text.length;i+=40000)chunks.push([text.slice(i,i+40000)]);sheet.clearContents();sheet.getRange(1,1,chunks.length,1).setNumberFormat('@').setValues(chunks);}
