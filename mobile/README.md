# Acrobatic mobile apps

Android APK와 iOS 앱 프로젝트다. 두 앱은 동일한 HTTPS 서버에 연결하며 KAIST 이메일로 로그인한다. 실제 명단과 비밀번호는 앱 설치 파일에 포함하지 않는다. 앱 안에서 팀 화면을 표시하고, 운영체제의 사진 선택기·공유·탐색 기능을 사용한다. 기본 훈련 가이드와 모식도는 앱에 포함돼 오프라인에서도 볼 수 있다.

## Android

- Android 8.0 이상, APK 직접 설치
- Gradle 8.13, JDK 17, Android SDK 36, AGP 8.13.2
- `cd mobile/android && gradle :app:assembleDebug`
- 배포 APK는 비공개 PKCS12 서명 키로 서명한다. 이후 업데이트도 같은 키와 증가한 `versionCode`를 사용한다.
- GitHub Actions secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
- 키는 저장소에 넣지 않는다. 빌드 중 복원한 파일은 작업 종료 시 제거한다.

## iOS

macOS와 Xcode에서 `brew install xcodegen` 후 `cd mobile/ios && xcodegen generate`를 실행하고 생성된 `Acrobatic.xcodeproj`를 연다. iOS 16 이상을 대상으로 한다. CI는 iPhone 시뮬레이터 검사와 서명 없는 기기용 컴파일을 수행한다.

**iOS 소스 ZIP과 서명 없는 아카이브는 아이폰에 설치하는 파일이 아니다.** TestFlight/App Store 배포에는 Apple Developer Program 가입, 개인 계정의 배포 인증서·프로비저닝 프로파일과 App Store Connect 앱 등록이 필요하다. 현재는 배포 자격과 서명이 연결되지 않았다. 가입이나 결제를 자동으로 진행하지 않는다. 가입 후 Xcode의 Signing & Capabilities에서 개인 Team을 지정하고, 고유 bundle ID를 확인한 뒤 Product → Archive → Distribute App → App Store Connect로 업로드한다. Apple 처리와 필요한 심사가 끝나면 실제 TestFlight 초대 링크를 공유한다.

## 알림과 업데이트

앱 설정의 **개인 훈련 알림**은 매주 월요일 18:15(한국시간)에 반복한다. 사용자가 직접 허용·활성화하며 해제할 수 있다. Android는 절전 정책에 따라 알림 시간이 지연될 수 있다. 휴강 여부는 앱 공지를 확인한다. 이 알림은 새 공지를 서버에서 받는 푸시와 구분한다. 네이티브 원격 푸시는 FCM/APNs 설정이 연결되지 않아 제공하지 않는다.

팀 화면 변경은 공통 서버에서 반영된다. Android 실행 파일 업데이트는 앱 설정의 GitHub 릴리스 링크에서 새 APK를 받는다. iOS 바이너리 업데이트는 배포 연결 후 TestFlight/App Store로 제공한다.

## 검사

- Android: URL 허용 범위와 한국시간 알림 계산, 린트, 서명 검증, 에뮬레이터 앱 실행 및 오프라인 가이드
- iOS: URL 허용 범위, 알림 시간·번들 가이드, iPhone 시뮬레이터 앱 실행 및 오프라인 가이드, 기기용 아카이브 컴파일
- 실제 갤럭시·아이폰 하드웨어 검사는 별도로 진행한다.
