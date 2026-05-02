# Crypto_App — 일일 시장 리포트 iPhone 앱

## 한 줄 요약
본인 iPhone에 설치해서 **버튼 한 번으로 일일 시장 리포트(크립토 + 미국 주식 + 한국 주식/ETF)를 생성·열람**하는 개인용 React Native 앱.

## 배경
- 원본은 `daily-market-report/` 폴더에 들어있는 Claude Code 플러그인 (zip 풀린 결과).
  - 3-way 병렬 수집(crypto / chrome / naver collector) → docx 리포트 → 카카오톡 발송.
  - 매일 06:30 / 13:00 / 21:00 KST 자동 트리거.
- 이번 프로젝트는 위 플러그인을 **iPhone 앱으로 재구성**한다.
  - **카카오톡 발송 X**, **앱 안에서 생성·표시** 까지 모두 처리.
  - 일정 자동화 X, **사용자가 버튼 누를 때만 실행** (개인 디바이스 단독 동작).
- 사용 대상: 본인 1명, 본인 폰 1대. **App Store 심사·배포 불필요.**

## 결정사항 (사용자 확정)

| 항목 | 결정 |
|---|---|
| 앱 형태 | **Expo + EAS (React Native)** — TestFlight 또는 Expo Go로 본인 폰에 설치 |
| 백엔드 | **없음** — 데이터 수집·LLM 분석·렌더링 전부 폰 안에서 처리 |
| 자동화 | **없음** — 사용자가 앱 안에서 "리포트 생성" 버튼 누를 때만 실행 |
| 자산군 | 암호화폐 (BTC/ETH/알트) + 미국 주식(빅테크) + 한국 주식/ETF |
| 톤매너 | **초등학생한테 설명하듯 비유 + 구어체** ("비트코인이 오늘 롤러코스터를 탔어요!" 류) |
| 산출물 | 카테고리별 핵심 인사이트 + **투자 적합성 결론** 까지 자동 도출 |

## 핵심 제약: "서버 없음" → 아키텍처 함의

**원본 플러그인의 chrome-collector는 헤드리스 브라우저로 한경·Yahoo·investing.com을 스크래핑** 한다. 폰 안에서는 헤드리스 브라우저를 못 돌리므로:

- **스크래핑 의존부 폐기** → **공개 REST API만 사용** 으로 전면 전환.
- 공개 API 후보:
  - **크립토**: CoinGecko (무인증), Binance public, Upbit public (원본 그대로 활용 가능)
  - **미국 주식**: Yahoo Finance public (yfinance 호환 엔드포인트), Alpha Vantage 무료, Finnhub 무료
  - **한국 주식**: 네이버 금융 RSS·공개 endpoint, KRX 공개 데이터, Alpha Vantage `KRX:` 심볼
  - **뉴스**: NewsAPI 무료, RSS (Yahoo Finance, 한국경제 RSS) — 또는 Anthropic web_search tool 활용
- **LLM 분석**: Anthropic Messages API를 RN 클라이언트에서 직접 호출
  - API 키는 `expo-secure-store`에 저장 (본인 폰만 사용하므로 클라이언트 측 보관 허용)
  - 모델: 기본 `claude-sonnet-4-6`, 옵션으로 `claude-opus-4-7`
  - **prompt caching** 적용해 톤매너·템플릿 system 프롬프트 재사용 → 비용 절감

## 화면/기능 (잠정 — ultraplan에서 확정)

1. **홈**
   - 큰 "오늘 리포트 생성" 버튼
   - 자산군 토글 (크립토 / 미주 / 한주) — 원하는 것만 선택
   - 최근 리포트 카드 (마지막 N개)
2. **리포트 보기 (카테고리별 카드)**
   - 표지: 날짜·시각·"오늘의 시장 한 줄 요약" (비유 포함)
   - 카드 1 — 시장 통합 요약 (9행 통합 테이블의 RN 버전)
   - 카드 2 — 암호화폐
   - 카드 3 — 미국 주식
   - 카드 4 — 한국 주식 / ETF
   - 카드 5 — 거시·뉴스 핵심
   - 카드 6 — **종합 인사이트 + "오늘 투자 적합한 것 / 피해야 할 것" 결론**
   - 각 카드는 (a) 비유 헤드라인, (b) 데이터 근거(차트·표), (c) 초등학생식 풀이, (d) 액션 추천 4단 구조
3. **히스토리**: 과거 리포트 목록·검색·비교 (어제 vs 오늘)
4. **설정**: API 키 등록, 즐겨찾는 종목 편집, 톤 강도 슬라이더, 모델 선택

## 원본 자산 활용 / 폐기 매핑

| 원본 자산 | 처리 |
|---|---|
| `daily-market-report/agents/chrome-collector.md` | **폐기** (서버 없음 정책상 헤드리스 브라우저 불가) |
| `daily-market-report/agents/crypto-collector.md` | **로직 reference** — Upbit API 호출부를 TS로 포팅 |
| `daily-market-report/agents/naver-collector.md` | **로직 reference** — 네이버 검색 부분은 RSS/공개 엔드포인트로 대체 |
| `skills/generate-report/SKILL.md` | **워크플로 reference** — 오케스트레이션 흐름을 RN 함수로 옮김 |
| `skills/generate-report/references/docx-template.md` | **출력 구조 reference** — RN 카드 컴포넌트 설계의 base |
| `skills/generate-report/references/kakao-template.md` | **요약 톤 reference** — 단, 톤은 "초등학생 비유"로 재설계 |
| `skills/generate-report/references/INTERNALS.md` | **내부 동작 reference** |
| `routines/claude-routine.md`, `make_report_2100.py` | **폐기** (자동 실행 안 함) — 단, 분석 단계 분해 reference로 활용 |
| `시장보고서_*.docx` (산출물 예시 2개) | **출력 결과물 reference** — 톤·길이·구성 비교용 |

## 비기능 요구

- **보안**: 모든 API 키는 `expo-secure-store`. 외부 백엔드/서버에 절대 전송 X. 로그·텔레메트리 X.
- **비용**: 1회 리포트 생성 시 Anthropic API ≈ $0.05~0.20 예상 (Sonnet 4.6 + caching). 사용자가 직접 부담.
- **오프라인**: 마지막 리포트는 로컬 SQLite(`expo-sqlite`)에 저장 → 네트워크 없어도 열람 가능. 새 리포트 생성은 온라인 필요.
- **성능**: 리포트 생성 1회 30초 ~ 2분 목표. 진행 단계(수집 → 분석 → 결론)는 진행률로 표시.
- **권한**: 푸시·위치·카메라 등 불필요 권한 요청 X.

## 미정 사항 (ultraplan에서 결정)

- 정확한 종목 리스트 (BTC/ETH 외 알트 코인 — XRP/SAND 그대로? 변경?)
- 미주 빅테크 7종(MAG7) 고정 vs 사용자 편집 가능
- 한국 종목·ETF 기본 set
- 뉴스 소스 선정 (NewsAPI vs RSS vs Anthropic web_search)
- 차트 라이브러리 선정 (`victory-native`, `react-native-svg-charts`, `react-native-skia` 후보)
- LLM 호출 분해: 1-shot vs 다단계(수집-요약-결론) — 비용/품질 트레이드오프
- 사용자 메모리 컨텍스트("퇴직금 1억 달러전환 중")를 리포트 결론에 어떻게 반영할지 (개인화 프롬프트)
- 히스토리 보존 정책 (개수·기간 제한)

## 첫 마일스톤 후보

1. **M1 — 데이터 파이프**: 공개 API 클라이언트(크립토/미주/한주) + 정상화 모듈 + 단위 테스트.
2. **M2 — LLM 분석 코어**: Anthropic SDK 연결 + 톤매너 system 프롬프트 + 카테고리별 분석 함수 + prompt caching.
3. **M3 — RN 셸**: Expo 프로젝트 부트스트랩 + 라우팅 + SecureStore + SQLite 스키마.
4. **M4 — UI**: 홈/리포트/히스토리/설정 화면, 카드 컴포넌트, 차트.
5. **M5 — 통합**: end-to-end "버튼 → 리포트" 워크플로 + 본인 폰 설치.

## 참고 메모리 컨텍스트

사용자 메모리에 다음이 있음 (`stock-analyst` 스킬과 정합):
- 퇴직금 1억원 달러전환 투자자 — 미국 빅테크(AAPL/MSFT/GOOGL/AMZN/TSLA/NVDA/META) + BTC/ETH + KRW/USD 환율 트래킹.
- 펀더멘털 / 기술적분석 / 리스크 / 온체인 / 외환 5개 분석 모듈 통합.

→ **본 앱은 stock-analyst 스킬의 모바일·일일 리포트 버전** 으로 자리매김 가능. 결론부의 "투자 적합성" 판단 기준을 메모리 프로파일과 정렬한다.
