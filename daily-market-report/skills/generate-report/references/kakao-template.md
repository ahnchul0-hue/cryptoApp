# 카카오톡 메시지 템플릿

`generate-report` 스킬 STEP 6에서 `KakaotalkChat-MemoChat` 툴로 발송할 메시지의 표준 포맷입니다.
트리거 시각(`morning` / `midday` / `evening`)에 따라 헤더와 강조 포인트가 다릅니다.

---

## 공통 원칙

- 한 메시지 길이: **3000자 이내** (카톡 가독성 + 알림 미리보기 호환)
- 자산 순서: **암호화폐 → 한국 → 미국** (사용자 우선순위)
- 등락률은 항상 `±X.XX%` 형태, 부호 명시
- 핵심 모멘텀과 리스크는 각각 한 줄로 압축
- 보고서 파일 경로 안내 마지막 줄
- 투자에 대한 핵심 인사이트 반드시 필요
---

## 1. 아침 보고 (06:30 KST) — `morning`

```
[일일 시장 보고서] {YYYY.MM.DD} 06:30 (오전 보고)

▼ 암호화폐 (Upbit KRW, 24h 변동)
BTC  ₩{가격}  ({±%}%)
ETH  ₩{가격}  ({±%}%)
XRP  ₩{가격}  ({±%}%)
SAND ₩{가격}  ({±%}%)

▼ 한국 증시 (개장 전)
코스피 {가격}  ({±%}%)  | 코스닥 {가격}  ({±%}%)

▼ 미국 증시 (간밤 마감)
S&P500 {가격}  ({±%}%)
나스닥 {가격}  ({±%}%)
다우   {가격}  ({±%}%)

▼ 오늘의 핵심
{한 줄 모멘텀 - 미국 마감을 한국 개장이 어떻게 받아들일지}

▼ 리스크
{다섯 줄 리스크}

상세 보고서: {워킹폴더_경로}
```

**아침 보고 강조점**:
- 미국 증시는 "간밤 마감" 표시 (한국 시간 기준 전일 새벽)
- 한국 증시는 "개장 전" 표시 (09:00 개장 전 시점)
- 모멘텀은 "미국 마감 → 한국 개장 영향" 관점

---

## 2. 점심 보고 (13:00 KST) — `midday`

```
[일일 시장 보고서] {YYYY.MM.DD} 13:00 (점심 보고)

▼ 암호화폐 (Upbit KRW, 24h 변동)
BTC  ₩{가격}  ({±%}%)
ETH  ₩{가격}  ({±%}%)
XRP  ₩{가격}  ({±%}%)
SAND ₩{가격}  ({±%}%)

▼ 한국 증시 (오전장 마감)
코스피 {가격}  ({±%}%)  | 코스닥 {가격}  ({±%}%)
{시총 상위 변동 - 1줄}

▼ 미국 증시 (휴장 중, 전일 종가)
S&P500 {가격}  ({±%}%)
나스닥 {가격}  ({±%}%)
다우   {가격}  ({±%}%)

▼ 오전 흐름
{다섯 줄 - 한국 오전장 키워드와 분위기}

▼ 오후 관전 포인트
{다섯 줄 - 오후장에서 봐야 할 변수}

상세 보고서: {워킹폴더_경로}
```

**점심 보고 강조점**:
- 한국 증시 오전장 마감 직후이므로 가장 정보 밀도 높은 시점
- 시총 상위 종목 변동 3줄 추가
- "오전 흐름" + "오후 관전 포인트" 구조

---

## 3. 저녁 보고 (21:00 KST) — `evening`

```
[일일 시장 보고서] {YYYY.MM.DD} 21:00 (저녁 보고)

▼ 암호화폐 (Upbit KRW, 24h 변동)
BTC  ₩{가격}  ({±%}%)
ETH  ₩{가격}  ({±%}%)
XRP  ₩{가격}  ({±%}%)
SAND ₩{가격}  ({±%}%)

▼ 한국 증시 (정규장 마감)
코스피 {가격}  ({±%}%)  | 코스닥 {가격}  ({±%}%)

▼ 미국 증시 (개장 30분 전 / 프리마켓)
S&P500 {가격}  ({±%}%)
나스닥 {가격}  ({±%}%)
다우   {가격}  ({±%}%)

▼ 오늘의 결산 한 줄
{다섯 줄 - 한국 마감 + 미국 프리마켓 신호}

▼ 야간 모니터링 포인트
{다섯 줄 - 22:30 미국 개장 후 봐야 할 것}

상세 보고서: {워킹폴더_경로}
```

**저녁 보고 강조점**:
- 한국 정규장 마감 직후 + 미국 개장 직전 (22:30 KST 기준 30분 전)
- "오늘의 결산" + "야간 모니터링 포인트" 구조
- 미국 시장은 프리마켓 데이터가 있으면 우선, 없으면 전일 종가

---

## 발송 로직

```javascript
function buildKakaoMessage(reportData) {
  const { trigger, date, time, crypto, korean, us, analysis } = reportData;

  const cryptoBlock = `▼ 암호화폐 (Upbit KRW, 24h 변동)
BTC  ₩${crypto.btc.price}  (${crypto.btc.pct}%)
ETH  ₩${crypto.eth.price}  (${crypto.eth.pct}%)
XRP  ₩${crypto.xrp.price}  (${crypto.xrp.pct}%)
SAND ₩${crypto.sand.price}  (${crypto.sand.pct}%)`;

  const koreanBlock = buildKoreanBlock(trigger, korean);
  const usBlock = buildUsBlock(trigger, us);
  const analysisBlock = buildAnalysisBlock(trigger, analysis);

  const headerMap = {
    morning: "오전 보고",
    midday:  "점심 보고",
    evening: "저녁 보고"
  };

  return `[일일 시장 보고서] ${date} ${time} (${headerMap[trigger]})

${cryptoBlock}

${koreanBlock}

${usBlock}

${analysisBlock}

상세 보고서: ${reportData.filePath}`;
}
```

`buildKoreanBlock`, `buildUsBlock`, `buildAnalysisBlock`은 `trigger` 값에 따라 위 3개 템플릿 중 해당 섹션을 반환합니다.

---

## 발송 예외 처리

- **카톡 MCP 호출 실패**: 메시지 내용을 채팅에 출력 + 오류 사유 표시
- **메시지 3000자 초과**: 이슈/리스크 부분을 한 줄로 더 축약하여 재구성
- **수집 실패 항목 다수**: 헤더에 `(부분 수집)` 표기, 본문에는 "정보 없음"으로 채움
- **Upbit API 실패**: 암호화폐 블록을 `(Upbit 일시 오류)` 한 줄로 대체