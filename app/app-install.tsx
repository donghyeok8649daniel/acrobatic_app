'use client';
import {useLanguage} from '../lib/i18n';
import {nativePlatform} from '../lib/native-platform';

import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Monitor, Share2, Smartphone, WifiOff } from 'lucide-react';

type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function AppInstall({ visible = true }: { visible?: boolean }) {const {t:tr}=useLanguage();
  const [native, setNative] = useState<'android'|'ios'|null>(null);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setNative(nativePlatform());
    const display = window.matchMedia('(display-mode: standalone)');
    const sync = () => {
      setInstalled(Boolean(nativePlatform()) || display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      setOnline(navigator.onLine);
    };
    const offer = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const complete = () => { setInstalled(true); setPrompt(null); };
    sync();
    display.addEventListener('change', sync);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', complete);
    // Private API responses and videos are never stored by the service worker.
    if ('serviceWorker' in navigator && window.isSecureContext && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
        setMessage('설치 준비가 지연되고 있어요. 잠시 후 새로고침해주세요.');
      });
    }
    return () => {
      display.removeEventListener('change', sync);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', complete);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setMessage(outcome === 'accepted' ? '설치가 완료되면 앱 아이콘으로 실행하세요.' : '원할 때 브라우저 메뉴에서 다시 설치할 수 있어요.');
      setPrompt(null);
    } catch { setMessage('브라우저 메뉴에서 앱 설치를 선택해주세요.'); }
  };

  if (!visible) return null;
  if(native)return <section className="panel app-install"><h2>{tr('아크로바틱 모바일 앱')}</h2><p>{tr('다운로드한 앱으로 실행 중이에요. 같은 KAIST 이메일로 팀 기록을 함께 사용합니다.')}</p><p>{tr('상단 앱 설정에서 오프라인 훈련 가이드와 개인 훈련 알림을 이용하세요.')}</p>{native==='android'&&<a className="btn secondary" href="https://github.com/donghyeok8649daniel/acrobatic_app/releases/latest" target="_blank" rel="noreferrer">{tr('앱 업데이트 다운로드')}</a>}</section>;
  return <section className="panel app-install" aria-labelledby="app-install-title">
    <div className="install-intro">
      <img src="/icons/app-192.png" width="64" height="64" alt={tr("아크로바틱 앱")} />
      <div><span className="eyebrow">ACROBATIC, EVERYWHERE</span><h2 id="app-install-title">{tr("아크로바틱 앱 설치")}</h2><p>{tr("갤럭시와 아이폰, 컴퓨터에서 같은 KAIST 이메일로 사용하세요.")}</p></div>
    </div>
    <div className="binary-downloads"><a className="btn primary" href="https://github.com/donghyeok8649daniel/acrobatic_app/releases/download/mobile-v0.3.2/Acrobatic-Android-0.3.2.apk"><Download size={18}/>{tr('갤럭시 · Android APK 다운로드')}</a><a className="btn secondary" href="https://github.com/donghyeok8649daniel/acrobatic_app/releases/download/desktop-v0.2.0/Acrobatic-Setup-0.2.0-x64.exe"><Monitor size={18}/>{tr('Windows EXE 다운로드')}</a></div>
    <p className="soft-note">{tr('아이폰 설치 앱은 Apple Developer 배포 서명 연결 후 TestFlight로 제공할 예정이에요. 현재 설치 링크는 없어요.')}</p>
    <details className="browser-install"><summary>{tr('브라우저 홈 화면 설치 안내')}</summary>
    {tr(installed ? <div className="install-status"><CheckCircle2 size={19}/>{tr("앱으로 실행 중이에요.")}</div> : prompt ? <button className="btn primary" onClick={install}><Download size={18}/>{tr("브라우저 웹앱 설치")}</button> : <p className="soft-note">{tr("아래 방법으로 설치하세요. 브라우저에 따라 ‘앱 설치’ 또는 ‘홈 화면에 추가’로 표시됩니다.")}</p>)}
    <div className="install-methods">
      <article><Monitor size={23}/><h3>{tr("컴퓨터")}</h3><p>{tr("Chrome·Edge에서 사이트를 열고 주소창의 설치 아이콘 또는 메뉴의 ‘앱 설치’를 선택하세요.")}</p></article>
      <article><Smartphone size={23}/><h3>{tr("안드로이드")}</h3><p>{tr("Chrome에서 사이트를 열고 ⋮ 메뉴 → ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.")}</p></article>
      <article><Share2 size={23}/><h3>{tr("아이폰 · 아이패드")}</h3><p>{tr("Safari에서 사이트를 열고 공유 → ‘홈 화면에 추가’를 선택하세요. ‘웹 앱으로 열기’가 보이면 켜주세요.")}</p></article>
    </div>
    <p className="install-footnote">{tr("훈련·명단·장부는 인터넷에 연결했을 때 팀원들과 공유됩니다. 설치한 기기에서도 KAIST 이메일과 비밀번호로 로그인해주세요.")}</p>
    </details>
    {!online && <p className="install-status"><WifiOff size={18}/>{tr("연결이 끊겼어요. 인터넷 연결 후 다시 이용해주세요.")}</p>}
    {message && <p role="status" className="install-status">{tr(message)}</p>}
  </section>;
}
