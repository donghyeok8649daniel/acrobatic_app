import {env} from 'cloudflare:workers';
import {database} from './server-team';
import {passwordHash} from './password';
import type {TeamState} from './domain';
export function sheetConfig(){const config=JSON.parse(env.SHEET_SYNC_CONFIG||'{}');if(!config.teamId||!config.spreadsheetId||!env.SHEET_SYNC_TOKEN)throw Error('시트 연결 설정이 필요합니다.');return config as {teamId:string;spreadsheetId:string};}
export async function syncAccounts(state:TeamState,team:string){
 const statements=[];
 for(const member of state.members){const p=member.sheetProfile;if(!p)continue;
  const old=await database().prepare('SELECT email FROM email_accounts WHERE team=? AND member=?').bind(team,member.id).first<{email:string}>();
  if(old){statements.push(database().prepare('UPDATE email_accounts SET email=?,enabled=1 WHERE team=? AND member=?').bind(p.email,team,member.id));if(old.email!==p.email)statements.push(database().prepare('DELETE FROM sessions WHERE team=? AND member=?').bind(team,member.id));}
  else statements.push(database().prepare('INSERT INTO email_accounts(email,team,member,password,must_change,enabled) VALUES (?,?,?,?,1,1) ON CONFLICT(team,member) DO NOTHING').bind(p.email,team,member.id,await passwordHash(p.studentNumber,env.AUTH_PEPPER||'')));
 }
 const ids=state.members.map(m=>m.id);if(!ids.length)throw Error('현재 명단이 비어 있습니다.');
 statements.push(database().prepare(`UPDATE email_accounts SET enabled=0 WHERE team=? AND member NOT IN (${ids.map(()=>'?').join(',')})`).bind(team,...ids));
 statements.push(database().prepare('DELETE FROM sessions WHERE team=? AND member IN (SELECT member FROM email_accounts WHERE team=? AND enabled=0)').bind(team,team));
 await database().batch(statements);
}
