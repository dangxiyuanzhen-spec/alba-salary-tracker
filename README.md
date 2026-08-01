# 한국 편의점 알바 급여관리 (Convenience Store Salary Tracker)

편의점·매장 알바 및 대타 근무 기록과 급여를 관리하는 순수 프론트엔드 PWA입니다.
서버, 데이터베이스, 로그인 없이 브라우저의 LocalStorage에만 데이터를 저장하며,
HTTPS로 배포한 뒤 휴대폰 홈 화면에 앱처럼 설치해 사용할 수 있습니다.

## 주요 기능

- **홈**: 오늘/이번 주/이번 달/올해/누적 수입, 누적 근무시간, 이번 달 예상 수입,
  평균 시급, 미수령·수령완료 급여를 영수증 스타일 카드와 통계 카드로 표시
- **근무 기록 추가/수정**: 날짜, 점포명, 주소, 사장님, 연락처, 출퇴근 시간, 휴게시간,
  시급, 교통비, 식대, 보너스, 공제, 메모, 정산 상태(미결산/결산됨/수령완료) 입력,
  실시간 급여 자동 계산 미리보기 (8시간 초과분은 설정된 배율로 연장수당 계산)
- **달력**: 월별 캘린더에 날짜별 근무시간·급여·색상(수령완료=초록, 미결산=노랑,
  결산됨=파랑, 휴무=빨강 계열)을 표시, 날짜 클릭 시 상세 기록 확인
- **통계**: Chart.js 기반 일별/주별/월별 급여, 월별 근무시간, 급여 추이, 근무시간 추이 차트
- **데이터 관리**: 검색, 점포별/상태별 필터, 날짜순·급여순 정렬, 수정/복제/삭제/상태 변경
- **내보내기/가져오기**: CSV, Excel(.xlsx), JSON 내보내기, JSON 가져오기, 백업/복원
- **설정**: 기본 시급, 기본 휴게시간, 기본 연장근무 배율, 다크모드, 자동 백업
- **PWA**: 오프라인 사용, 홈 화면 설치, 네이티브 앱과 유사한 독립 실행형 화면

## 기술 스택

- HTML5 / CSS3 (Glassmorphism, iOS 스타일, 반응형)
- JavaScript (ES6+, 프레임워크 없는 순수 Vanilla JS)
- [Chart.js](https://www.chartjs.org/) — 차트
- [SheetJS (xlsx)](https://sheetjs.com/) — Excel 내보내기
- LocalStorage — 데이터 저장 (서버/DB 없음)
- Service Worker + Web App Manifest — PWA

## 파일 구조

```
.
├── index.html          # 앱 구조 (홈/추가/달력/통계/설정)
├── style.css            # 디자인 시스템 및 반응형 스타일
├── app.js                # 앱 로직 (계산, 렌더링, 저장, 차트, 내보내기 등)
├── manifest.json         # PWA 매니페스트
├── service-worker.js     # 오프라인 캐싱
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── maskable-512.png
│   └── apple-touch-icon.png
└── README.md
```

## 로컬 실행

정적 파일이므로 별도 빌드 과정이 필요 없습니다. 다만 Service Worker와
`fetch` 관련 기능은 `file://` 프로토콜에서 제한될 수 있으므로 간단한 로컬 서버로
실행하는 것을 권장합니다.

```bash
# Python 3
python3 -m http.server 8080

# 또는 Node.js
npx serve .
```

브라우저에서 `http://localhost:8080` 접속.

## 배포 방법

### GitHub Pages
1. 이 폴더의 모든 파일을 GitHub 저장소 루트(또는 `docs/` 폴더)에 업로드
2. 저장소 **Settings → Pages**에서 배포 브랜치와 폴더 지정
3. 발급된 `https://<username>.github.io/<repo>/` 주소로 접속

### Vercel
1. [vercel.com](https://vercel.com)에서 새 프로젝트 생성 후 이 폴더를 연결(또는 CLI로 `vercel` 실행)
2. Framework Preset은 **Other**로 두면 별도 빌드 명령 없이 정적 파일이 그대로 배포됩니다

### Cloudflare Pages
1. Cloudflare 대시보드에서 **Workers & Pages → Create → Pages**
2. 저장소 연결 또는 파일 직접 업로드, 빌드 명령 없이 배포

### Netlify
1. [app.netlify.com](https://app.netlify.com)에서 이 폴더를 드래그 앤 드롭하거나 저장소 연결
2. 빌드 명령 없이 정적 사이트로 바로 배포됩니다

> 어떤 방식으로 배포하든 **HTTPS**가 자동 적용되며, HTTPS 환경에서만 Service Worker와
> 홈 화면 설치(PWA)가 정상 동작합니다.

## 홈 화면에 설치하기

- **iOS (Safari)**: 공유 버튼 → "홈 화면에 추가"
- **Android (Chrome)**: 우측 상단 메뉴 → "홈 화면에 추가" 또는 자동으로 뜨는 설치 배너 사용

## 데이터 보관 및 백업 안내

모든 근무 기록과 설정은 **이 브라우저(기기)의 LocalStorage**에만 저장됩니다.
서버로 전송되지 않으며, 다른 기기와 자동 동기화되지 않습니다.

- 기기를 바꾸거나 브라우저 데이터를 지우기 전에는 **설정 → JSON 내보내기** 또는
  **일괄 백업**으로 파일을 저장해 두세요.
- 새 기기·브라우저에서는 **설정 → JSON 가져오기**로 백업 파일을 불러오면 됩니다.
- "자동 백업"을 켜두면 기록을 저장할 때마다 브라우저 내부에 최신 백업이 자동 보관되며,
  **백업 복원** 버튼으로 파일 없이도 가장 최근 상태로 되돌릴 수 있습니다.

## 라이선스

이 프로젝트는 자유롭게 수정·배포하여 사용할 수 있습니다.
