# 아크로바틱 Windows 앱

Electron으로 온라인 팀 앱을 전용 창에서 실행합니다. 팀원 명단·입장코드·DB·영상은 설치 파일에 포함하지 않으며, 온라인 사이트와 같은 서버에서 로그인하고 기록을 공유합니다. 브라우저나 Node.js를 별도로 설치하지 않아도 됩니다.

## 다운로드와 설치

[GitHub Releases](https://github.com/donghyeok8649daniel/acrobatic_app/releases/latest)에서 `Acrobatic-Setup-…-x64.exe`를 받으세요. 실행하면 현재 사용자 계정에 설치하고 바탕화면과 시작 메뉴에 ‘아크로바틱’을 만듭니다. Windows 설정 → 앱 → 설치된 앱에서 제거할 수 있습니다. Windows 10/11 64비트와 인터넷 연결이 필요합니다.

초기 배포는 Windows 코드 서명이 없습니다. 각 Release의 `SHA256SUMS.txt`로 설치 파일의 SHA-256을 확인할 수 있습니다. 영상 업로드는 서버의 R2 저장소 활성화·연결 후 이용할 수 있습니다.

## 개발과 빌드

이 폴더에서 실행합니다. 루트 웹 앱의 의존성과 분리되어 있습니다.

```sh
npm ci
npm test
npm start
npm run build:win
```

설치 파일은 `release/Acrobatic-Setup-버전-x64.exe`에 생성됩니다. `desktop-v버전` Git 태그를 푸시하면 GitHub Actions의 Windows 러너가 같은 잠금 파일로 빌드한 뒤 Release에 설치 파일과 SHA-256을 업로드합니다. 수동 워크플로 실행은 Actions 아티팩트만 생성합니다.

원격 페이지는 Node.js 접근·preload·webview 없이 격리된 샌드박스에서 실행하며, 팀 서버 이외의 페이지로 앱 창이 이동하지 않도록 제한합니다. 파일 다운로드·영상 선택은 일반 Chromium 기능을 사용합니다. 카메라·마이크·위치 등 기기 권한은 요청하지 않습니다. 연결 실패 시 개인 정보가 없는 재연결 화면을 표시합니다.

개인 기기 최초 설정 시 앱 사용자 데이터 폴더의 `first-login.json`에 해당 사용자의 `teamId`와 `code`만 둘 수 있습니다. 앱이 정상 로그인 API로 인증하고 실제 세션을 확인한 뒤 이 일회성 파일을 삭제합니다. 이 파일이나 실제 팀 정보를 저장소·설치 프로그램에 포함하면 안 됩니다. 다른 팀원에게는 각자의 입장코드를 전달합니다.
