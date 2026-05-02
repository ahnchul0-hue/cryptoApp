# INTERNALS — 내부 동작 깊이 파기

플러그인의 핵심 메커니즘을 깊이 이해하고 싶을 때 참고하는 문서. 각 컴포넌트가 "왜 이렇게 설계되었는가"를 설명합니다.

---

## 1. 3-way 병렬 실행 메커니즘

### Claude의 단일 메시지 다중 툴 호출

Claude Code는 한 응답 안에 여러 개의 `<tool_use>` 블록을 넣으면 **모두 동시에** 실행합니다. 순차 실행이 아니라 진정한 병렬입니다.

```
잘못된 패턴 (순차):
  메시지1: Agent crypto-collector 호출
  → 응답 대기 (8초)
  메시지2: Agent chrome-collector 호출
  → 응답 대기 (15초)
  메시지3: Agent naver-collector 호출
  → 응답 대기 (12초)
  총 35초

올바른 패턴 (병렬):
  메시지1: Agent crypto-collector + chrome-collector + naver-collector 동시 호출
  → 세 응답을 한꺼번에 대기
  → 가장 느린 에이전트 시간만큼만 소요 (약 15초)
```

### 왜 SKILL.md에 "단일 메시지" 강조가 반복되는가

LLM이 "신중하게" 행동하려는 경향 때문에, 별도 지시가 없으면 한 번에 한 개씩 호출하기 쉽습니다. SKILL.md STEP 2에서 "반드시 단일 메시지에 세 개의 Agent 툴 호출", "순차 실행 절대 금지"를 명시하여 이 경향을 차단합니다.

### 결과 합성 시 결과 마커가 중요한 이유

각 에이전트가 `=== CRYPTO_COLLECTOR_RESULT === ... === END ===` 형태의 명확한 마커로 결과를 감싸기 때문에, 오케스트레이터가 세 응답을 받아도 어느 에이전트의 결과인지 즉시 식별 가능합니다. 마커가 없으면 세 결과가 텍스트 뭉치로 섞여 합성 단계에서 데이터 누락 위험이 큽니다.

---

## 2. make_report.js 깊이 파기

### docx 라이브러리의 동작 원리

`docx` npm 패키지는 OOXML(Office Open XML) 명세에 따라 ZIP 컨테이너 안에 XML 파일들을 묶어 .docx를 생성합니다. `Document` 객체를 빌드하면 라이브러리가 다음 XML들을 자동 생성합니다:

```
시장보고서_20260501_0630.docx (실제로는 ZIP 파일)
├── [Content_Types].xml          ← MIME 타입 매핑
├── word/document.xml            ← 본문 (Paragraph, Table 트리)
├── word/styles.xml              ← 스타일 정의
├── word/header1.xml             ← 헤더
├── word/footer1.xml             ← 푸터
└── _rels/.rels                  ← 관계 정의
```

`Packer.toBuffer(doc)`가 이 모든 XML을 메모리에서 생성한 뒤 ZIP으로 압축해 Buffer로 반환합니다. 이걸 `fs.writeFileSync`로 디스크에 떨어뜨리면 .docx 완성.

### DXA 단위 이해

DXA(Twentieths of a Point)는 Word 내부 단위입니다.
- 1 inch = 1440 DXA
- 1 cm ≈ 567 DXA
- 1 pt = 20 DXA

코드에서 자주 보이는 숫자들:
- `12240` = 8.5 inch (페이지 너비, US Letter)
- `15840` = 11 inch (페이지 높이)
- `1080` = 0.75 inch (여백)
- `9360` = 6.5 inch (인쇄 가능 영역 = 12240 - 1080×2)

테이블 컬럼 너비 합계가 9360인 이유는 인쇄 영역에 정확히 맞추기 위함입니다.

### 폰트 크기는 왜 size: 22?

docx의 `size` 속성은 **half-points** 단위입니다.
- `size: 22` = 11pt (본문 표준)
- `size: 20` = 10pt (테이블 셀)
- `size: 28` = 14pt (Heading 1)
- `size: 52` = 26pt (표지 큰 제목)

### ShadingType.CLEAR vs SOLID

- `CLEAR`: 배경색을 깔지만 텍스트 위에 다른 패턴 없음. 모든 Word 버전에서 안전하게 렌더링.
- `SOLID`: 일부 구버전 Word(2010 이전)와 일부 LibreOffice 버전에서 색이 까맣게 칠해지거나 텍스트가 안 보이는 버그 있음.

`docx-template.md`가 `CLEAR만, SOLID 금지`로 못박은 이유.

### 한글 폰트가 Arial?

`font: "Arial"`로 지정해도 한글은 Word가 자동으로 시스템 한글 폰트(보통 맑은 고딕)로 fallback 합니다. 한글 폰트를 명시하면 오히려 사용자 시스템에 그 폰트가 없을 때 깨집니다. Arial은 영문 폰트 + 한글 자동 fallback의 가장 안전한 조합.

### 유니코드 불릿(•) 금지 이유

`•`(U+2022)는 일부 폰트에서 박스(□)로 깨져 보입니다. 특히 한국 시스템에서 한글-영문 혼합 텍스트의 fallback 폰트가 변할 때 자주 발생. 텍스트 하이픈(`-`)은 ASCII라 절대 깨지지 않음.

### color: GREEN("006400")가 한국 관습인 이유

미국 시장: 상승=초록, 하락=빨강
한국·일본 시장: 상승=빨강, 하락=파랑 (혹은 초록)

이 보고서는 글로벌 자산을 다루므로 Western 관습(상승=GREEN)으로 통일했습니다. 한국 관습으로 바꾸려면 `make_report.js`의 색상 매핑만 변경하면 됩니다.

### Buffer 패턴이 Promise인 이유

```javascript
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT, buffer);
});
```

`Packer.toBuffer`는 ZIP 압축을 백그라운드에서 처리하므로 비동기입니다. 큰 문서일수록 압축에 시간이 걸리므로 동기 버전이 없습니다. `.catch`로 압축 오류(메모리 부족 등) 처리.

---

## 3. chrome-collector 폴백 체인 깊이 파기

### 왜 한경이 1차?

| 비교 항목 | 한경 | Yahoo Finance | investing.com |
|-----------|------|---------------|---------------|
| 한국어 페이지 | O | X | O (선택) |
| 단일 페이지 정보 밀도 | 높음 | 보통 | 낮음 |
| Cookie 동의 팝업 | 없음 | 있음 | 있음 (큰 팝업) |
| reCAPTCHA 노출 빈도 | 거의 없음 | 가끔 | 자주 |
| 미국 증시 한국어 표기 | 있음 | 없음 | 부분 |

한경이 모든 면에서 우월하지만 점검·장애 가능성이 있어 폴백 필요.

### read_page의 depth 파라미터

`read_page(depth: N, max_chars: M)`은 페이지의 접근성 트리(Accessibility Tree)를 깊이 N까지 추출합니다.

- `depth: 1`: 최상위 랜드마크만 (header, main, footer). 4000자 정도.
- `depth: 3`: 컨텐츠 카드 레벨까지 (현재가, 등락률 등이 보임). 8000자 정도.
- `depth: 5`: 모든 텍스트 노드. 20000자 이상이면 잘림.

가격 데이터는 보통 `<main>` > `<section>` > `<div class="price">` 레벨에 있으므로 depth 3이 적정.

### Yahoo Finance 추출 시 주의점

Yahoo는 React로 동적 렌더링되는 페이지라 첫 로딩 시 `loading...` 상태가 길게 보일 수 있습니다. `navigate` 후 즉시 `read_page`를 호출하면 빈 결과가 나오기도 합니다. 이를 방지하려면:

1. `navigate` 후 1~2초 대기 (Claude in Chrome은 네트워크 idle을 기다림)
2. `read_page` 결과에 `regularMarketPrice` 또는 큰 숫자(`152,300.00` 형태)가 없으면 1회 재시도
3. 그래도 없으면 다음 폴백으로

### investing.com의 함정

investing.com은 GDPR 동의 팝업이 페이지 위를 덮습니다. `read_page`는 시각적 가림과 무관하게 DOM을 읽으므로 데이터는 가져올 수 있지만, 한국에서 접속 시 가끔 KOR 도메인(`kr.investing.com`)으로 자동 리다이렉트되어 URL이 변합니다. 이때 `data-test="instrument-price-last"` 속성 키가 다를 수 있어 한국어 라벨(`현재가`, `등락률`)을 같이 찾는 패턴이 안전.

### tabs_context_mcp의 createIfEmpty

`tabs_context_mcp`는 현재 활성 탭 정보를 반환합니다. 사용자가 Chrome을 열어둔 상태가 아니면 탭이 없으므로 `createIfEmpty: true`로 빈 탭을 만들어야 합니다. 이 옵션 없이 호출하면 에이전트가 탭 ID를 못 받아 navigate 실패.

---

## 4. crypto-collector가 단순한 이유

세 에이전트 중 가장 짧고 단순한데, 이유는 명확합니다:

| 비교 | crypto-collector | chrome-collector | naver-collector |
|------|------------------|------------------|------------------|
| 데이터 소스 | 공식 API (JSON) | 웹 페이지 (HTML) | 검색 API (snippet) |
| 인증 필요 | X | X (브라우저) | MCP 인증 |
| 폴백 필요 | 사실상 불필요 | 3단 폴백 | 키워드 다양화 |
| 응답 시간 | 200ms | 5~10초 | 2~3초 |
| 실패 시나리오 | Upbit 점검 (드물다) | 사이트 변경 (잦다) | 검색 결과 없음 |

JSON API는 구조화된 응답이라 파싱 코드를 한 번에 작성 가능. HTML 스크래핑은 사이트 구조 변경에 취약해서 폴백 체인 필요. crypto-collector는 단 하나의 curl 명령으로 모든 일을 끝냅니다.

### Upbit API의 `signed_change_rate` 처리

```python
change_rate = item['signed_change_rate'] * 100
```

Upbit는 등락률을 소수(예: `0.01540` = 1.54%)로 반환하므로 100을 곱해 % 변환. `change_rate` (음수 가능, signed가 붙은 이유)와 `change_rate`(절댓값)이 따로 있으므로 부호 있는 값을 써야 합니다.

### KST 시각 변환

```python
from datetime import datetime, timezone, timedelta
kst = timezone(timedelta(hours=9))
now = datetime.now(kst).strftime('%Y.%m.%d %H:%M')
```

서버 시간대가 UTC인 경우가 많아 명시적으로 KST(+09:00)로 변환. `datetime.now()` 단독 호출은 환경에 따라 결과가 달라집니다.

---

## 5. naver-collector가 검색을 9번 하는 이유

암호화폐 4 + 한국 3 + 미국 2 + 거시 3 = 12개 키워드 (실제 9~12회).
한 번에 다 검색하려고 키워드를 합치면(`"코스피 코스닥 비트코인"`) 검색 엔진이 AND 조합으로 처리해서 결과가 빈약해집니다. 키워드별로 따로 검색해야 각 도메인 뉴스가 풍부.

`display: 5`로 각각 5건씩 받아도 totals 60건이 채 안 되므로 토큰 부담 적음.

---

## 6. 트리거 시각별 데이터 의미 차이

| 시각 | 한국 증시 | 미국 증시 | 비고 |
|------|----------|----------|------|
| 06:30 | 휴장 (개장 전) | 정규장 마감 직후 | 미국 야간 → 한국 개장 시그널 |
| 13:00 | 오전장 마감 | 장기 휴장 (전일 종가) | 한국 오전 마감 결산 |
| 21:00 | 정규장 마감 (15:30) | 개장 1시간 전 (프리마켓) | 한국 마감 결산 + 미국 시그널 |

이 차이 때문에 카카오톡 템플릿이 트리거별로 강조점이 다릅니다.

미국 정규장은 22:30 KST (서머타임) ~ 23:30 KST (스탠다드타임) 개장. 이 보고서는 정규장 데이터를 다루지 않고 종가/프리마켓만 처리합니다. 정규장 실시간 데이터가 필요하면 별도 트리거(예: 02:00 KST 아침 추가 보고)를 추가하면 됩니다.

---

## 7. 보고서 파일명 규칙의 의미

`시장보고서_20260501_0630.docx`

- 알파벳 정렬 시 시간순으로 정렬됨 (date format이 YYYYMMDD라 자연 정렬과 일치)
- 같은 날 3개 보고서가 한 폴더에 쌓임:
  - `시장보고서_20260501_0630.docx`
  - `시장보고서_20260501_1300.docx`
  - `시장보고서_20260501_2100.docx`
- 한 달 후: 90개 파일이 시간순으로 깔끔하게 정렬

별도 디렉토리 구조 없이 평면 파일명만으로 시계열 자료가 됩니다.

---

## 8. 향후 확장 포인트

플러그인을 늘릴 때 건드릴 지점:

| 추가하고 싶은 것 | 변경할 파일 |
|-----------------|------------|
| 새 코인 (예: SOL) | `crypto-collector.md`의 markets 파라미터 + `docx-template.md` 데이터 구조 + `kakao-template.md` |
| 새 미국 지수 (예: 러셀2000) | `chrome-collector.md` 폴백 체인 + `docx-template.md` |
| 새 트리거 시각 (예: 23:00) | `routines/claude-routine.md`에 4번째 루틴 추가 + `kakao-template.md`에 새 trigger 키 |
| 슬랙 발송 추가 | `SKILL.md` STEP 6 확장 + Slack MCP 연결 |
| 차트 이미지 첨부 | `make_report.js`에 `ImageRun` 추가 + matplotlib/Chart.js로 PNG 생성 |
| 주간 요약 보고서 | 별도 스킬 `weekly-report` 추가, 일간 docx 7개를 입력으로 받아 합성 |
