'use client';
import {House,Target,Wallet,Users,Menu} from 'lucide-react';
import {useLanguage} from '../lib/i18n';
export function MobileNav({page,onNavigate,onMenu}:{page:string;onNavigate:(id:string)=>void;onMenu:()=>void}){const {t}=useLanguage();return <nav className="mobile-bottom-nav" aria-label={t('앱 메뉴')}>{[{id:'home',label:'홈',icon:House},{id:'training',label:'훈련',icon:Target},{id:'finance',label:'동비',icon:Wallet},{id:'members',label:'부원',icon:Users},{id:'more',label:'더보기',icon:Menu}].map(item=><button key={item.id} className={page===item.id?'active':''} aria-current={page===item.id?'page':undefined} onClick={()=>item.id==='more'?onMenu():onNavigate(item.id)}><item.icon size={21}/><span>{t(item.label)}</span></button>)}</nav>;}
