# daily-market-report v0.2

암호화폐(Upbit)·한국 증시·미국 증시 데이터를 **3-way 병렬 수집**하여 일일 보고서(.docx)를 자동 생성하고, **하루 3회(06:30·13:00·21:00 KST)** 카카오톡으로 요약을 발송하는 Claude Code 플러그인입니다.

## v0.2 신규 사항

| 항목 | v0.1 | v0.2 |
|------|------|------|
| 자산 커버리지 | 한국·미국 증시 | **암호화폐 4종 + 한국·미국 증시** |
| 병렬 에이전트 | 2개 | **3개** |
| 미국 증시 데이터 | 한국경제 단독 | **한경 → Yahoo Finance → investing.com 폴백 체인** |
| 자동 실행 | 수동 | **Claude Routines로 일 3회 자동** |
| 카카오톡 템플릿 | 인라인(누락) | **`references/kakao-template.md`로 분리** |
| 내부 문서 | 없음 | **`docs/INTERNALS.md` 추가** |

## 아키텍처

```
[사용자 요청 또는 Claude Routine 트리거]
     |
     v
generate-report 스킬 (오케스트레이터)
     |
     +---- TodoWrite로 6개 작업 등록
     |
     v
+============================================+
|   3-way 병렬 실행 (단일 메시지에 동시 호출)   |
|                                              |
|  +------------------------+                  |
|  | crypto-collector       | <- bash + Upbit API
|  |   KRW-BTC,ETH,XRP,SAND |                  |
|  +------------------------+                  |
|  +------------------------+                  |
|  | chrome-collector       | <- Claude in Chrome
|  |   한경 (1차)            |                  |
|  |   Yahoo Finance (2차)   |                  |
|  |   investing.com (3차)   |                  |
|  +------------------------+                  |
|  +------------------------+                  |
|  | naver-collector        | <- NaverSearch MCP
|  |   뉴스·이슈·거시지표     |                  |
|  +------------------------+                  |
+============================================+
     |
     v (3개 에이전트 결과 합성)
docx 보고서 생성 (node + docx)
     |
     v
워킹 폴더 저장 + 카카오톡 요약 발송
```

## 컴포넌트

| 컴포넌트 | 유형 | 역할 |
|---------|------|------|
| `generate-report` | 스킬 | 전체 워크플로우 오케스트레이션 |
| `crypto-collector` | 에이전트 | Upbit 공개 API로 KRW-BTC/ETH/XRP/SAND 수집 |
| `chrome-collector` | 에이전트 | 한국경제·Yahoo·investing 3단 폴백 |
| `naver-collector` | 에이전트 | 네이버 검색으로 뉴스·이슈·거시 변수 수집 |

## 트리거 문구

- "증시 보고서 만들어줘"
- "오늘 시장 보고서"
- "암호화폐 증시 보고서"
- "코인 주식 일일 요약"
- "마켓 리포트"
- (Claude Routine에서 자동 호출)

## 보고서 구성

| 섹션 | 내용 |
|------|------|
| 표지 | 날짜·시각 |
| 1. 오늘의 시장 요약 | **암호화폐 4종 + 한국 2지수 + 미국 3지수 = 9행 통합 테이블** |
| 2. 암호화폐 (Upbit KRW) | BTC·ETH·XRP·SAND 가격·24h 등락·고저·이슈 |
| 3. 한국 증시 | 코스피·코스닥, 시총 상위, 이슈 |
| 4. 미국 증시 | S&P500·나스닥·다우, 거시 지표, 이슈 |
| 5. 종합 분석 | 모멘텀·리스크 |
| 6. 데이터 출처 | URL·수집 항목 |

## 필요 조건

| MCP / 도구 | 용도 | 비고 |
|-----------|------|------|
| `bash` (Claude Code 기본) | Upbit API 호출 | crypto-collector 전용 |
| Claude in Chrome | 한경·Yahoo·investing 스크래핑 | chrome-collector 전용 |
| NaverSearch MCP | 뉴스·이슈 검색 | naver-collector 전용 |
| KakaotalkChat MCP | 카카오톡 발송 | 오케스트레이터 |

Upbit API는 인증·키 없이 호출 가능. 환경변수·시크릿 설정 불필요합니다.

## 자동 실행 설정

`routines/claude-routine.md`의 절차에 따라 Claude Routines를 등록하면 매일 06:30·13:00·21:00 KST에 자동으로 보고서 생성 및 카카오톡 발송이 이루어집니다.

## 폴더 구조

```
daily-market-report/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── agents/
│   ├── crypto-collector.md
│   ├── chrome-collector.md
│   └── naver-collector.md
├── skills/
│   └── generate-report/
│       ├── SKILL.md
│       └── references/
│           ├── docx-template.md
│           └── kakao-template.md
├── routines/
│   └── claude-routine.md
└── docs/
    └── INTERNALS.md
```
