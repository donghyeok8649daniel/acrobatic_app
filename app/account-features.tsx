'use client';
import {useState} from 'react';
import {useLanguage,LanguageSwitch} from '../lib/i18n';
export function PasswordForm({required=false,email,onChanged,onLogout}:{required?:boolean;email:string;onChanged:()=>Promise<void>;onLogout?:()=>Promise<void>}){
 const {t}=useLanguage();const [busy,B]=useState(false),[error,E]=useState(''),[done,D]=useState(false);
 return <section className="panel"><h2>{t(required?'첫 로그인 비밀번호 변경':'내 비밀번호 변경')}</h2><p className="hint">{email}</p><p>{t(required?'팀 기록을 보기 전에 학번 대신 사용할 새 비밀번호를 설정해주세요.':'현재 비밀번호를 확인한 뒤 새 비밀번호로 변경할 수 있습니다.')}</p><form className="form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);E('');D(false);if(f.get('newPassword')!==f.get('confirmPassword')){E('새 비밀번호가 서로 다릅니다.');return;}B(true);try{const r=await fetch('/api/team',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'changePassword',payload:{currentPassword:f.get('currentPassword'),newPassword:f.get('newPassword')}})});const d:any=await r.json();if(!r.ok)throw Error(d.error);await onChanged();D(true);}catch(err){E((err as Error).message);}finally{B(false);}}}>
 <label><span>{t(required?'현재 비밀번호 · 학번':'현재 비밀번호')}</span><input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128}/></label>
 <label><span>{t('새 비밀번호')}</span><input name="newPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128}/><small>{t('10~128자 · 학번과 다른 비밀번호')}</small></label>
 <label><span>{t('새 비밀번호 확인')}</span><input name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128}/></label>
 {error&&<p className="entry-error" role="alert">{t(error)}</p>}{done&&<p role="status">{t('비밀번호를 변경했습니다.')}</p>}
 <button className="btn primary full" disabled={busy}>{t(busy?'저장하는 중…':'비밀번호 변경')}</button></form>{onLogout&&<button className="text-btn" onClick={()=>void onLogout()}>{t('로그아웃')}</button>}</section>;
}
export function PasswordGate(props:Parameters<typeof PasswordForm>[0]){return <main className="password-gate"><LanguageSwitch/><PasswordForm {...props} required/></main>;}
