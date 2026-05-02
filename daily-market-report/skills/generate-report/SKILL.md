---
name: generate-report
description: >
  암호화폐(BTC/ETH/XRP/SAND)·한국 증시·미국 증시 일일 보고서를 자동 생성하는 스킬.
  "증시 보고서 만들어줘", "오늘 시장 보고서", "암호화폐 증시 보고서", "코인 주식 일일 요약",
  "마켓 리포트", "일일 증시 요약" 등을 언급하면 반드시 이 스킬을 사용한다.
  Claude Routines로 일 3회(06:30·13:00·21:00 KST) 자동 실행되도록 설계되어 있다.
  crypto-collector·chrome-collector·naver-collector 3개 에이전트를 병렬로 실행하여
  데이터를 수집한 뒤 docx 보고서를 생성하고 카카오톡으로 요약을 발송한다.
metadata:
  version: "0.2.0"
  author: "소에노"
---

## 개요

이 스킬은 세 개의 서브 에이전트를 **동시에** 실행하여 데이터 수집 시간을 단축한다. 4개 자산군(암호화폐 4종 + 한국 2지수 + 미국 3지수)을 한 번에 커버한다.

```
3-way 병렬 실행:
  ┌─ crypto-collector  (Upbit API)         ─┐
  ├─ chrome-collector  (한경/Yahoo/투자닷컴) ─┤→ 합성 → docx → 카톡
  └─ naver-collector   (네이버 MCP)        ─┘
```

## 단계별 지침

### STEP 1: 진행 상황 추적 초기화

TodoWrite로 아래 작업 목록을 설정한다:
- [ ] 3-way 병렬 데이터 수집 (crypto + chrome + naver 동시 실행)
- [ ] 수집 데이터 합성
- [ ] docx 보고서 생성
- [ ] 워킹 폴더에 저장
- [ ] 카카오톡 요약 발송
- [ ] 완료 보고

### STEP 2: 3-way 병렬 에이전트 실행 ⚡ (가장 중요)

**반드시 단일 메시지에 세 개의 Agent 툴 호출을 동시에 포함해야 한다.**
순차 실행 절대 금지.

```
Agent 1 (crypto-collector):
  description: "Upbit KRW 마켓 4종 시세 수집"
  subagent_type: "general-purpose"
  prompt: """
    당신은 crypto-collector 에이전트입니다.
    [agents/crypto-collector.md의 지침을 따라]
    Upbit API로 KRW-BTC, KRW-ETH, KRW-XRP, KRW-SAND 시세를 수집하세요.
    === CRYPTO_COLLECTOR_RESULT === 형식으로 반환하세요.
  """

Agent 2 (chrome-collector):
  description: "한국·미국 증시 데이터 수집 (한경/Yahoo/investing 폴백)"
  subagent_type: "general-purpose"
  prompt: """
    당신은 chrome-collector 에이전트입니다.
    [agents/chrome-collector.md의 지침을 따라]
    한국경제를 1차 소스로 Yahoo Finance와 investing.com 폴백을 사용하여
    코스피·코스닥·S&P500·나스닥·다우 데이터를 수집하세요.
    === CHROME_COLLECTOR_RESULT === 형식으로 반환하세요.
  """

Agent 3 (naver-collector):
  description: "네이버 MCP로 암호화폐·증시 뉴스·이슈·거시경제 데이터 수집"
  subagent_type: "general-purpose"
  prompt: """
    당신은 naver-collector 에이전트입니다.
    [agents/naver-collector.md의 지침을 따라]
    네이버 검색 MCP로 오늘의 암호화폐·증시 뉴스와 이슈를 수집하세요.
    === NAVER_COLLECTOR_RESULT === 형식으로 반환하세요.
  """
```

세 에이전트의 결과를 모두 기다린다. 일부가 실패해도 성공한 결과로 진행한다.

### STEP 3: 데이터 합성

세 에이전트의 결과를 바탕으로 아래 데이터 구조를 구성한다:

```javascript
reportData = {
  date: "YYYY.MM.DD",
  time: "HH:MM",
  trigger: "morning|midday|evening",  // 06:30/13:00/21:00 구분

  crypto: {
    btc:  { price, change, changePct, high, low, volume, color },
    eth:  { ... },
    xrp:  { ... },
    sand: { ... },
    issues: [ "이슈1", "이슈2", ... ]
  },

  korean: {
    kospi:  { price, change, changePct, source, note },
    kosdaq: { price, change, changePct, source, note },
    topStocks: [ { name, price, changePct } ],
    issues: [ "이슈1", "이슈2", ... ]
  },

  us: {
    sp500:  { price, change, changePct, source, marketStatus },
    nasdaq: { price, change, changePct, source, marketStatus },
    dow:    { price, change, changePct, source, marketStatus },
    issues: [ "이슈1", "이슈2", ... ]
  },

  macro: {
    oil:    "방향/수치",
    dollar: "방향/수치",
    rate:   "방향/수치"
  },

  analysis: {
    momentum:    "글로벌 공통 모멘텀 한 줄",
    cryptoChar:  [ "특징1", ... ],
    koreanChar:  [ "특징1", ... ],
    usChar:      [ "특징1", ... ],
    risks:       [ "리스크1", "리스크2", ... ]
  },

  meta: {
    fallbacksUsed: { kospi: "hankyung", sp500: "yahoo", ... },
    failedItems:   [ "있으면 기재" ]
  }
}
```

누락된 데이터는 `"정보 없음"`으로 채운다.

`time` 기준 트리거 분류:
- `04:00 ~ 11:59` → `"morning"` (오전 보고)
- `12:00 ~ 17:59` → `"midday"` (점심 보고)
- `18:00 ~ 03:59` → `"evening"` (저녁 보고)

### STEP 4: docx 보고서 생성

자세한 생성 방법은 `references/docx-template.md` 참조.

요약:
1. `npm install --prefix /tmp/report-build docx` 로 패키지 설치
2. `/tmp/report-build/make_report.js` 에 생성 스크립트 작성 (STEP 3 데이터를 실제값으로 채워서)
3. `node /tmp/report-build/make_report.js` 실행
4. 출력 파일: `/tmp/report-build/시장보고서_{YYYYMMDD}_{HHMM}.docx`

파일명 규칙: `시장보고서_{날짜8자리}_{시각4자리}.docx` (예: `시장보고서_20260501_0630.docx`)

### STEP 5: 워킹 폴더에 저장

```bash
cp /tmp/report-build/시장보고서_{날짜}_{시각}.docx \
   {사용자_워킹폴더}/시장보고서_{날짜}_{시각}.docx
```

사용자 워킹 폴더는 `/sessions/*/mnt/Claude/` 패턴으로 찾는다.
파일 저장 후 `computer://` 링크로 사용자에게 공유한다.

### STEP 6: 카카오톡 요약 발송

`KakaotalkChat-MemoChat` 툴로 요약 메시지를 전송한다.
메시지 포맷은 `references/kakao-template.md`의 `trigger` 별 템플릿을 사용한다.

발송 후 STEP 1의 TodoWrite를 모두 완료 상태로 업데이트하고, 사용자에게 다음을 요약 보고한다:
- 보고서 파일 경로 (`computer://` 링크)
- 사용된 폴백 (있으면)
- 카카오톡 발송 성공 여부

## 오류 처리

- **에이전트 부분 실패**: 성공한 에이전트 데이터만으로 보고서 생성, 실패 항목은 "수집 실패" 표시
- **docx 생성 실패**: 오류 메시지 확인 후 재시도 (주로 npm 설치 경로 문제)
- **카카오톡 발송 실패**: 실패 알리고 메시지 내용을 채팅에 출력하여 수동 발송 가능하게 함
- **모든 에이전트 실패**: 보고서 생성 중단, 사용자에게 명확히 보고

## 중요 원칙

- **병렬성**: STEP 2에서 세 에이전트는 반드시 동시 실행. 이것이 이 스킬의 핵심 가치
- **암호화폐 우선**: 보고서·카톡 모두 암호화폐 → 한국 → 미국 순서로 표시 (사용자 우선순위)
- **완결성**: 일부 데이터 없어도 보고서 완성하여 전달
- **신속성**: TodoWrite로 진행상황 실시간 업데이트
- **재현성**: Claude Routines로 자동 실행되므로 어떤 입력에도 동일한 출력 구조 보장
