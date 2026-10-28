'use client';
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {Languages} from 'lucide-react';
import {translate,type Language} from './translations';

const storageKey='courtin-language';
const LanguageContext=createContext({language:'ko' as Language,setLanguage:(_language:Language)=>{}});
export function LanguageProvider({children}:{children:ReactNode}){
 const [language,setLanguage]=useState<Language>('ko');
 useEffect(()=>{
  try{const saved=localStorage.getItem(storageKey);if(saved==='en'||saved==='ko')setLanguage(saved);}catch{}
  const sync=(event:StorageEvent)=>{if(event.key===storageKey&&(event.newValue==='ko'||event.newValue==='en'))setLanguage(event.newValue);};
  window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
 },[]);
 useEffect(()=>{document.documentElement.lang=language;document.title=language==='en'?'KAIST Acrobatic':'KAIST 아크로바틱';},[language]);
 const value=useMemo(()=>({language,setLanguage:(next:Language)=>{setLanguage(next);try{localStorage.setItem(storageKey,next);}catch{}}}),[language]);
 return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage(){
 const {language,setLanguage}=useContext(LanguageContext);
 const t=useMemo(()=>function text<T>(value:T):T{return (typeof value==='string'?translate(value,language):value) as T;},[language]);
 return {language,setLanguage,t,locale:language==='en'?'en-US':'ko-KR',weekday:(index:number)=>language==='en'?['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][index]:'일월화수목금토'[index]};
}
export function LanguageSwitch(){
 const {language,setLanguage}=useLanguage();
 return <label className="language-switch"><Languages size={16}/><select aria-label="Language / 언어" value={language} onChange={event=>setLanguage(event.target.value as Language)}><option value="ko">한국어</option><option value="en">English</option></select></label>;
}
