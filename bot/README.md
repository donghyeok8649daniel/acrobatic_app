# 아크로바틱 카톡 봇 — Redroid / Iris

앱의 훈련공지와 참석 예정 기록을 기존 카카오톡 일반 단체채팅방에 연결하는 어댑터다. Python 표준 라이브러리만 사용한다. 부원의 휴대폰·PC 대신 별도 Linux 서버에서 Redroid와 카카오톡을 계속 실행한다.

**현재 구현과 검증 범위:** 앱 API 및 가짜 Iris 응답을 사용한 통합 테스트를 통과한다. 실제 VPS, 카카오톡 계정 로그인, 실제 단톡방 전송은 별도로 연결·검증해야 한다. 카카오 공식 그룹봇 제휴 승인과 독립적인 비공식 클라이언트 방식이다. 카카오톡 버전 변경·로그인 제한의 영향을 받을 수 있다.

## 동작

1. 관리자가 앱의 **훈련 · 매뉴얼 → 훈련공지**에서 매뉴얼을 선택하고 게시한다.
2. 서버가 앱을 약 10초 간격으로 확인하고 일정·장소·투표/가이드 링크를 Iris로 전송한다. 단순 정기 일정 생성은 공지 발송으로 취급하지 않는다.
3. 부원은 앱의 **팀 설정 → 카카오톡 연결**에서 5분짜리 일회용 코드를 발급하고 단톡방에 `!link 코드`를 보낸다. 앱 로그인과 첫 비밀번호 변경을 먼저 마쳐야 한다. 카톡 닉네임으로 사람을 추측하지 않는다.
4. 카톡에서 `!참석 2026-11-02`, `!불참 2026-11-02`, `!미정 2026-11-02`로 응답한다. 영어는 `!yes`, `!no`, `!maybe`다. 여러 훈련이 있으면 날짜를 생략할 수 없다. 같은 날짜에 두 훈련이 있으면 링크에 표시되는 event ID를 사용한다.
5. 앱과 봇은 동일한 회원 ID·훈련 ID의 `event.attendance`를 갱신한다. 앱 변경도 다음 확인 주기에 단톡방에 최신 집계 메시지로 전달된다. 기본 카톡 투표나 이미 발송된 메시지를 수정하는 기능은 아니다.
6. `!현황 날짜` / `!status DATE`, `!가이드 날짜` / `!guide DATE`, `!도움말` / `!help`를 지원한다. 모식도는 로그인한 앱의 가이드에서 확인한다. 카톡이 없는 부원은 앱에서만 응답한다.

앱 화면은 약 5초 간격으로 상태를 확인한다. 연결 상태와 서버 장애에 따라 지연될 수 있으며 실시간 전송을 보장하지 않는다. 앱에서 실제 출석부와 참석 예정 투표는 구분된다.

## 서버 연결 전 필요한 것

- 개인 명의 Linux VPS: ARM64 또는 AMD64, Docker Compose, `binder_linux` 등 Redroid 필수 커널 기능. 일반 웹 호스팅/Cloudflare Workers에서는 실행할 수 없다. 초기 검증은 2 CPU·4 GB RAM 이상을 출발점으로 삼되 실제 메모리 사용량을 확인한다.
- 서버에 로그인할 **봇 전용 카카오톡 계정**과 본인 인증. 주 사용 계정을 다른 Android에 로그인하면 기존 휴대폰 세션에 영향을 줄 수 있으므로 자동으로 개인 계정을 사용하지 않는다. 계정 생성·SMS 인증·로그인은 사용자가 직접 처리한다.
- 신뢰할 수 있는 출처의 카카오톡 앱을 Redroid에 설치한다. 제3자 패치 APK를 자동 다운로드하거나 배포하지 않는다. 최신 카카오톡에서 Iris가 실제로 작동하는지 먼저 확인한다.
- [Iris 공식 릴리스](https://github.com/dolidolih/Iris/releases)의 `Iris.apk`. 파일을 `bot/assets/Iris.apk`에 두고 검증한 SHA-256을 설정한다. 버전과 해시는 배포 기록에 보관한다. APK·로그인 세션은 Git에 올리지 않는다.

서버가 준비되면 운영자가 서버 구성·배포를 수행한다. 일반 부원이 스크립트나 개발 도구를 설치할 필요는 없다.

## 배포 구성

먼저 앱 D1에 `drizzle/0005_kakao_bridge.sql` 마이그레이션을 적용한다. 기존 회원·재정·훈련 기록을 변경하지 않고 연결·중복 방지·상태 테이블만 추가한다.

앱 Worker에 다음 값을 비공개로 설정한다. 토큰은 32자 이상 무작위 값으로 만들고 Git이나 채팅에 출력하지 않는다.

| Worker 비공개 설정 | 용도 |
| --- | --- |
| `KAKAO_BRIDGE_TOKEN` | 봇 서버 전용 API 인증 |
| `KAKAO_BRIDGE_TEAM_ID` | 해당 팀으로 권한 제한 |
| `KAKAO_ROOM_ID` | 실제 일반 단톡방의 숫자 ID |

서버의 `bot/.env`에 동일한 토큰·방 ID와 아래 값을 설정한다. `.env`는 Git에서 제외된다.

```dotenv
APP_ORIGIN=https://YOUR-APP.example
KAKAO_BRIDGE_TOKEN=GENERATE_A_RANDOM_SECRET_AT_LEAST_32_CHARS
KAKAO_ROOM_ID=YOUR_NUMERIC_ROOM_ID
KAKAO_BOT_ID=YOUR_NUMERIC_BOT_USER_ID
IRIS_WEBHOOK_TOKEN=GENERATE_ANOTHER_RANDOM_SECRET_AT_LEAST_32_CHARS
IRIS_APK_SHA256=VERIFIED_SHA256_OF_OFFICIAL_IRIS_RELEASE
REDROID_IMAGE=redroid/redroid:14.0.0_64only-latest
```

실제 배포에서는 Redroid 이미지의 검증한 digest를 고정한다. 개인 사용자가 아닌 봇 계정으로 앱 초기 로그인을 완료하고, 지정 단톡방에 봇 계정을 초대한 뒤 숫자 방 ID를 확인한다. 카톡 방 이름만 보고 자동으로 선택하지 않는다.

```sh
cd bot
docker compose config --quiet
docker compose up -d --build
docker compose exec bridge python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8790/health').read().decode())"
```

Redroid와 Iris는 재부팅 후 자동 재시작한다. `android-data`에는 로그인 상태, `bridge-data`에는 송수신 대기열이 보존된다. 이 볼륨을 삭제하지 않는다. 초기 카톡 로그인은 SSH로 ADB를 터널링한 화면에서 수행한다. ADB는 `127.0.0.1:15555`에만 노출된다. Iris 포트와 webhook은 Docker 내부에서만 사용한다. 외부에 공개할 HTTP 포트가 없다. Redroid의 privileged 권한은 전용 VPS 안에서만 사용한다.

## 전송 처리

- 수신 메시지는 지정 방·메시지 ID로 중복 제거하고 명령어만 저장한다. 앱에 전달한 후 원문을 지운다. 일반 대화 내용은 저장하지 않는다.
- 앱은 일회용 연결코드와 카톡 사용자 ID의 해시를 저장한다. 봇에게 학번·이메일·회비·계좌 정보나 비밀번호를 제공하지 않는다.
- 재시작해도 미처리 수신 명령과 발송 대기열은 SQLite에 남는다. 다른 훈련이나 회원의 응답을 덮어쓰지 않도록 앱 API에서 버전 비교와 메시지 중복 방지를 함께 적용한다.
- Iris의 `success:true, message:Enqueued`는 발송 대기열 접수다. 봇 자신의 **새 채팅 로그**에서 내용을 확인한 뒤에만 `sent`로 기록한다. 이는 수신자의 수신·읽음 확인은 아니다.
- 타임아웃이나 프로세스 중단으로 발송 여부가 불명확하면 `uncertain`으로 남기고 재조회한다. 중복·순서 역전을 막기 위해 그 상태에서는 이후 발송을 멈춘다. 앱에서 확인 필요 상태를 표시한다. 실제 방 확인 없이 무조건 재전송하지 않는다.
- 저장된 볼륨을 초기화하면 중복 방지 이력이 사라진다. 서버 이전 시 두 볼륨을 함께 이전해야 한다.

## 연결 완료 판정

아래 항목을 실제 서버·실제 방에서 통과하기 전에는 자동 발송이 켜졌다고 안내하지 않는다.

- 휴대폰·PC를 끈 상태에서 서버 프로세스가 유지되고, 서버 재부팅 후 Iris·브리지가 복구된다.
- 앱의 시험 훈련공지가 지정 방에만 올라오고, 투표/훈련가이드 링크가 Android·iPhone 앱 로그인 후 같은 훈련을 연다.
- 두 부원을 각자의 연결코드로 연결한 뒤 카톡 응답 → 앱 반영, 앱 변경 → 카톡 집계를 확인한다.
- 코드 만료·재사용, 다른 방, 미연결 계정, 연결 해제, 비활동·사용 중지 계정을 검증한다.
- 네트워크 중단·프로세스 재시작 후 중복 집계와 무조건 재전송이 발생하지 않는지 확인한다.

## 자동 테스트

```sh
python -m unittest discover -s bot -p 'test_*.py'
npm run test:kakao
```

참고: [Redroid](https://github.com/remote-android/redroid-doc), [Iris](https://github.com/dolidolih/Iris). 이 저장소에는 두 프로젝트의 바이너리나 코드를 복사하지 않고 문서화된 인터페이스로 연결한다.
