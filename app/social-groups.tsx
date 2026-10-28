'use client';
import {useLanguage} from '../lib/i18n';
import {socialGroup} from '../lib/social-groups';
import type {TeamState} from '../lib/domain';
export function SocialGroups({state}:{state:TeamState}){const {t}=useLanguage();return <section className="panel social-groups"><div className="section-title"><div><h2>{t('친목조 구성')}</h2><p>{t('주포지션 기준으로 구성합니다. 매니저는 지정된 조에 함께합니다.')}</p></div></div><div className="club-position-list">{[['attack','공격수 친목조'],['setter','세터 친목조'],['defense','수비 친목조']].map(([id,name])=>{const members=state.members.filter(m=>m.active!==false&&socialGroup(m)===id);return <div key={id}><h3>{t(name)} <b>{members.length}{t('명')}</b></h3><p>{members.map(m=>m.name).join(' · ')||'—'}</p></div>;})}</div></section>;}
