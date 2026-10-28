# 아이폰 무료 Apple ID 설치

`Acrobatic-iOS-resign-*.ipa`는 **개인 Apple ID로 재서명해 설치하는 기기용 앱**이다. 유료 Apple Developer 가입 없이 Sideloadly·SideStore에서 설치할 수 있다. Safari에서 IPA 파일을 눌러 바로 설치하는 방식은 아니다. 각 사용자가 자신의 Apple 계정으로 서명한다.

무료 서명의 유효기간은 **7일**이다. 만료 전 갱신해야 계속 실행된다. 무료 계정은 기기당 활성 앱 수에도 제한이 있다. Apple 계정의 비밀번호·인증코드는 서명 도구에서 직접 입력하며 동아리 앱이나 저장소에 제출하지 않는다.

## Windows에서 처음 설치: Sideloadly

1. [공식 Sideloadly](https://sideloadly.io/)를 설치한다. 공식 안내에 따라 Windows용 Apple iTunes·iCloud 구성 요소도 준비한다. 기존 Apple 프로그램의 설치 방식에 따라 호환 조건이 다르므로 공식 안내를 따른다.
2. 아이폰을 USB로 연결하고 아이폰에서 컴퓨터를 신뢰한다.
3. GitHub 릴리스에서 `Acrobatic-iOS-resign-*.ipa`를 받아 Sideloadly에 넣는다.
4. 자신의 무료 Apple ID로 로그인하고 필요한 2단계 인증을 완료한 뒤 서명·설치를 실행한다. Apple ID 서명 모드를 사용한다. JIT나 별도 앱 개조는 필요하지 않다.
5. 아이폰 설정의 일반 → VPN 및 기기 관리에서 본인 계정의 개발자 앱을 신뢰한다. iOS 16 이상은 개인정보 보호 및 보안 → 개발자 모드도 활성화한다. 메뉴 명칭은 iOS 버전에 따라 다를 수 있다.
6. 아크로바틱 앱을 열고 **KAIST 이메일**로 로그인한다. Apple ID는 설치 서명에만 사용한다.

자동 갱신은 Sideloadly가 실행되는 컴퓨터와 아이폰이 연결되어 있어야 작동한다. 처음 USB로 연결해 설치한 뒤 같은 네트워크의 Wi-Fi 갱신도 설정할 수 있다. 컴퓨터를 항상 켜두는 대신 만료 전에 연결해 갱신해도 된다.

## 설치 후 폰에서 갱신: SideStore

처음에는 컴퓨터와 USB 연결이 필요하다. [SideStore 준비 안내](https://docs.sidestore.io/docs/installation/prerequisites)와 [설치 안내](https://docs.sidestore.io/docs/installation/install)에 따라 iloader로 SideStore를 설치한다. 이후 아이폰의 SideStore에서 아크로바틱 IPA를 불러와 설치한다. 갱신할 때는 공식 안내의 Wi-Fi와 LocalDevVPN 연결 조건을 충족하고 앱 만료 전에 갱신한다. 초기 설치 뒤에는 갱신용 컴퓨터를 상시 운영할 필요가 없다. 페어링이 만료되거나 기기를 초기화하면 컴퓨터 연결이 다시 필요할 수 있다.

## 확인한 범위

iPhone 시뮬레이터 검사와 기기용 컴파일, IPA의 `Payload/Acrobatic.app` 구조를 확인한다. 실제 아이폰에서 개인 Apple ID로 서명·설치하는 과정은 기기 소유자가 진행해야 하며 아직 실기기 검증은 하지 않았다. 팀 기록은 서버에 보관되므로 서명 갱신과 별개다.

참고: [Apple 무료 Personal Team 제한](https://developer.apple.com/help/account/basics/about-your-developer-account), [Sideloadly 공식 안내](https://sideloadly.io/), [SideStore 공식 문서](https://docs.sidestore.io/).
