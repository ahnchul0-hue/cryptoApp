# docx 보고서 생성 템플릿 (v0.2)

이 파일은 `generate-report` 스킬이 docx 파일을 생성할 때 참조하는 Node.js 스크립트 구조입니다.
v0.2부터 보고서 첫 섹션에 **암호화폐(Upbit KRW)** 가 추가되었습니다.

## 환경 준비

```bash
# 첫 실행 시에만 (이후 캐시됨)
npm install --prefix /tmp/report-build docx

# 스크립트 실행
node /tmp/report-build/make_report.js
```

## 보고서 섹션 구성

| # | 섹션 | 내용 |
|---|------|------|
| 표지 | 표지 | 제목·날짜·시각 |
| 1 | 오늘의 시장 요약 | 9행 통합 테이블 (BTC·ETH·XRP·SAND + 코스피·코스닥 + S&P·나스닥·다우) |
| 2 | 암호화폐 (Upbit KRW) | 4종 상세 + 24h 고저·거래대금 + 이슈 |
| 3 | 한국 증시 | 이슈 + 시총 상위 |
| 4 | 미국 증시 | 이슈 + 거시 지표 |
| 5 | 종합 분석 | 모멘텀·리스크 |
| 6 | 데이터 출처 | 폴백 사용 내역 포함 |

## 스크립트 구조 (make_report.js)

```javascript
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber
} = require('/tmp/report-build/node_modules/docx');
const fs = require('fs');

// ── 색상 팔레트 ──────────────────────────────
const BLUE_DARK   = "1F3864";
const BLUE_MID    = "2E75B6";
const BLUE_LIGHT  = "D5E8F4";
const GRAY_LIGHT  = "F2F2F2";
const GREEN       = "006400";
const RED_DARK    = "C00000";
const ORANGE_BTC  = "F7931A";   // 비트코인 브랜드 컬러
const PURPLE_ETH  = "627EEA";   // 이더리움 브랜드 컬러
const WHITE       = "FFFFFF";

// ── 데이터 (STEP 3에서 실제값으로 채움) ──────
const DATE = "{날짜}";              // 예: "2026.05.01"
const TIME = "{시각}";              // 예: "06:30"
const TRIGGER = "{morning|midday|evening}";

const DATA = {
  // 암호화폐 (Upbit KRW)
  crypto: {
    btc:  { price: "{값}", change: "{값}", pct: "{값}", high: "{값}", low: "{값}",
            volume: "{값}", color: GREEN },
    eth:  { price: "{값}", change: "{값}", pct: "{값}", high: "{값}", low: "{값}",
            volume: "{값}", color: GREEN },
    xrp:  { price: "{값}", change: "{값}", pct: "{값}", high: "{값}", low: "{값}",
            volume: "{값}", color: GREEN },
    sand: { price: "{값}", change: "{값}", pct: "{값}", high: "{값}", low: "{값}",
            volume: "{값}", color: GREEN }
  },
  // 한국·미국 증시
  kospi:  { price: "{값}", change: "{값}", pct: "{값}", source: "{값}", color: GREEN },
  kosdaq: { price: "{값}", change: "{값}", pct: "{값}", source: "{값}", color: GREEN },
  sp500:  { price: "{값}", change: "{값}", pct: "{값}", source: "{값}", marketStatus: "{값}", color: GREEN },
  nasdaq: { price: "{값}", change: "{값}", pct: "{값}", source: "{값}", marketStatus: "{값}", color: GREEN },
  dow:    { price: "{값}", change: "{값}", pct: "{값}", source: "{값}", marketStatus: "{값}", color: GREEN },

  topStocks: [ /* { name, price, pct, color } */ ],
  cIssues: [ /* "암호화폐 이슈" */ ],
  kIssues: [ /* "한국 이슈" */ ],
  uIssues: [ /* "미국 이슈" */ ],

  macro: { oil: "{값}", dollar: "{값}", rate: "{값}" },
  risks: [ /* "리스크" */ ],

  fallbacksUsed: { /* 자산: 사용된 소스 */ }
};

// ── 헬퍼 함수 ────────────────────────────────
const noBorders = {
  top:    { style: BorderStyle.NONE, size: 0, color: "auto" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
  left:   { style: BorderStyle.NONE, size: 0, color: "auto" },
  right:  { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideH:{ style: BorderStyle.NONE, size: 0, color: "auto" },
  insideV:{ style: BorderStyle.NONE, size: 0, color: "auto" }
};

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE_MID } },
    children: [new TextRun({ text, font: "Arial", size: 28, bold: true, color: BLUE_DARK })]
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 24, bold: true, color: BLUE_MID })]
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({
      text, font: "Arial", size: opts.size || 22, color: opts.color || "333333",
      bold: opts.bold || false
    })]
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: 360 },
    children: [
      new TextRun({ text: "- ", font: "Arial", size: 22, color: BLUE_MID }),
      new TextRun({ text, font: "Arial", size: 22, color: "333333" })
    ]
  });
}

function spacer(pt = 120) {
  return new Paragraph({ spacing: { before: 0, after: pt } });
}

function headerRow(labels, widths) {
  return new TableRow({
    tableHeader: true,
    children: labels.map((label, i) => new TableCell({
      shading: { fill: BLUE_MID, type: ShadingType.CLEAR },
      width: { size: widths[i], type: WidthType.DXA },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: label, font: "Arial", size: 20, bold: true, color: WHITE })]
      })]
    }))
  });
}

function dataRow(cells, widths, aligns, isEven, colors = []) {
  const bg = isEven ? GRAY_LIGHT : WHITE;
  return new TableRow({
    children: cells.map((cell, i) => new TableCell({
      shading: { fill: bg, type: ShadingType.CLEAR },
      width: { size: widths[i], type: WidthType.DXA },
      children: [new Paragraph({
        alignment: aligns[i] === "right" ? AlignmentType.RIGHT :
                   aligns[i] === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 60, after: 60 },
        children: [new TextRun({
          text: cell, font: "Arial", size: 20, color: colors[i] || "333333"
        })]
      })]
    }))
  });
}

// 카테고리 헤더 행 (암호화폐/한국/미국 구분용)
function categoryRow(label, totalWidth) {
  return new TableRow({
    children: [new TableCell({
      shading: { fill: BLUE_LIGHT, type: ShadingType.CLEAR },
      width: { size: totalWidth, type: WidthType.DXA },
      columnSpan: 5,
      children: [new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: label, font: "Arial", size: 20, bold: true, color: BLUE_DARK })]
      })]
    })]
  });
}

// ── 문서 생성 ────────────────────────────────
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22, color: "333333" } }
    }
  },
  sections: [{
    properties: {
      page: {
        size:   { width: 12240, height: 15840 },
        margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE_MID } },
          children: [new TextRun({
            text: `일일 시장 보고서 | ${DATE} ${TIME}`,
            font: "Arial", size: 18, color: BLUE_MID
          })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "- ", font: "Arial", size: 18, color: "888888" }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: "888888" }),
            new TextRun({ text: " -", font: "Arial", size: 18, color: "888888" })
          ]
        })]
      })
    },
    children: [
      // ── 표지 ──
      spacer(600),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 60 },
        children: [new TextRun({
          text: "일일 시장 보고서",
          font: "Arial", size: 52, bold: true, color: BLUE_DARK
        })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 30 },
        children: [new TextRun({
          text: "암호화폐 · 한국 증시 · 미국 증시",
          font: "Arial", size: 26, color: BLUE_MID
        })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({
          text: `${DATE} ${TIME} KST`,
          font: "Arial", size: 32, color: BLUE_MID
        })]
      }),
      spacer(400),

      // ── 1. 오늘의 시장 요약 (통합 9행 테이블) ──
      heading1("1. 오늘의 시장 요약"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
          headerRow(["자산", "현재가", "등락폭", "등락률", "비고"],
                   [2200, 1960, 1400, 1400, 2400]),

          // 암호화폐 4종
          categoryRow("암호화폐 (Upbit KRW)", 9360),
          dataRow(["비트코인 (BTC)", DATA.crypto.btc.price, DATA.crypto.btc.change,
                   DATA.crypto.btc.pct, "24h 변동"],
                  [2200,1960,1400,1400,2400], ["left","right","right","right","left"], false,
                  ["","","",DATA.crypto.btc.color,""]),
          dataRow(["이더리움 (ETH)", DATA.crypto.eth.price, DATA.crypto.eth.change,
                   DATA.crypto.eth.pct, "24h 변동"],
                  [2200,1960,1400,1400,2400], ["left","right","right","right","left"], true,
                  ["","","",DATA.crypto.eth.color,""]),
          dataRow(["리플 (XRP)", DATA.crypto.xrp.price, DATA.crypto.xrp.change,
                   DATA.crypto.xrp.pct, "24h 변동"],
                  [2200,1960,1400,1400,2400], ["left","right","right","right","left"], false,
                  ["","","",DATA.crypto.xrp.color,""]),
          dataRow(["샌드박스 (SAND)", DATA.crypto.sand.price, DATA.crypto.sand.change,
                   DATA.crypto.sand.pct, "24h 변동"],
                  [2200,1960,1400,1400,2400], ["left","right","right","right","left"], true,
                  ["","","",DATA.crypto.sand.color,""]),

          // 한국 증시
          categoryRow("한국 증시", 9360),
          dataRow(["코스피", DATA.kospi.price, DATA.kospi.change, DATA.kospi.pct,
                   `한국 대표지수 (${DATA.kospi.source})`],
                  [2200,1960,1400,1400,2400], ["left","right","right","right","left"], false,
                  ["","","",DATA.kospi.color,""]),
          dataRow(["코스닥", DATA.kosdaq.price, DATA.kosdaq.change, DATA.kosdaq.pct,
                   `중소형주 (${DATA.kosdaq.source})`],
                  [2200,1960,1400,1400,2400], ["left","right","right","right","left"], true,
                  ["","","",DATA.kosdaq.color,""]),

          // 미국 증시
          categoryRow("미국 증시", 9360),
          dataRow(["S&P 500", DATA.sp500.price, DATA.sp500.change, DATA.sp500.pct,
                   `${DATA.sp500.marketStatus} (${DATA.sp500.source})`],
                  [2200,1960,1400,1400,2400], ["left","right","right","right","left"], false,
                  ["","","",DATA.sp500.color,""]),
          dataRow(["나스닥", DATA.nasdaq.price, DATA.nasdaq.change, DATA.nasdaq.pct,
                   `${DATA.nasdaq.marketStatus} (${DATA.nasdaq.source})`],
                  [2200,1960,1400,1400,2400], ["left","right","right","right","left"], true,
                  ["","","",DATA.nasdaq.color,""]),
          dataRow(["다우존스", DATA.dow.price, DATA.dow.change, DATA.dow.pct,
                   `${DATA.dow.marketStatus} (${DATA.dow.source})`],
                  [2200,1960,1400,1400,2400], ["left","right","right","right","left"], false,
                  ["","","",DATA.dow.color,""])
        ]
      }),
      spacer(200),

      // ── 2. 암호화폐 (NEW) ──
      heading1("2. 암호화폐 (Upbit KRW)"),
      heading2("2-1. 4종 상세"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
          headerRow(["자산", "현재가", "24h 고가", "24h 저가", "24h 거래대금"],
                   [2200, 2000, 1800, 1800, 1560]),
          dataRow(["비트코인 (BTC)", DATA.crypto.btc.price, DATA.crypto.btc.high,
                   DATA.crypto.btc.low, DATA.crypto.btc.volume],
                  [2200,2000,1800,1800,1560], ["left","right","right","right","right"], false),
          dataRow(["이더리움 (ETH)", DATA.crypto.eth.price, DATA.crypto.eth.high,
                   DATA.crypto.eth.low, DATA.crypto.eth.volume],
                  [2200,2000,1800,1800,1560], ["left","right","right","right","right"], true),
          dataRow(["리플 (XRP)", DATA.crypto.xrp.price, DATA.crypto.xrp.high,
                   DATA.crypto.xrp.low, DATA.crypto.xrp.volume],
                  [2200,2000,1800,1800,1560], ["left","right","right","right","right"], false),
          dataRow(["샌드박스 (SAND)", DATA.crypto.sand.price, DATA.crypto.sand.high,
                   DATA.crypto.sand.low, DATA.crypto.sand.volume],
                  [2200,2000,1800,1800,1560], ["left","right","right","right","right"], true)
        ]
      }),
      spacer(100),
      heading2("2-2. 주요 이슈"),
      ...(DATA.cIssues.length > 0
          ? DATA.cIssues.map(issue => bullet(issue))
          : [para("주요 이슈 없음")]),
      spacer(200),

      // ── 3. 한국 증시 ──
      heading1("3. 한국 증시"),
      heading2("3-1. 주요 이슈"),
      ...(DATA.kIssues.length > 0
          ? DATA.kIssues.map(issue => bullet(issue))
          : [para("주요 이슈 없음")]),
      spacer(100),
      heading2("3-2. 시총 상위 종목"),
      DATA.topStocks.length > 0
        ? new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [
              headerRow(["종목명", "현재가", "등락률"], [4000, 2680, 2680]),
              ...DATA.topStocks.map((s, i) =>
                dataRow([s.name, s.price, s.pct],
                        [4000, 2680, 2680],
                        ["left", "right", "right"],
                        i % 2 === 1,
                        ["", "", s.color || GREEN])
              )
            ]
          })
        : para("데이터 수집 실패"),
      spacer(200),

      // ── 4. 미국 증시 ──
      heading1("4. 미국 증시"),
      heading2("4-1. 주요 이슈"),
      ...(DATA.uIssues.length > 0
          ? DATA.uIssues.map(issue => bullet(issue))
          : [para("주요 이슈 없음")]),
      spacer(100),
      heading2("4-2. 거시경제 지표"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
          headerRow(["지표", "현황"], [3000, 6360]),
          dataRow(["국제유가(WTI)", DATA.macro.oil], [3000, 6360], ["left", "left"], false),
          dataRow(["달러/원 환율",   DATA.macro.dollar], [3000, 6360], ["left", "left"], true),
          dataRow(["금리 동향",       DATA.macro.rate], [3000, 6360], ["left", "left"], false)
        ]
      }),
      spacer(200),

      // ── 5. 종합 분석 ──
      heading1("5. 종합 분석 및 시사점"),
      heading2("5-1. 주요 리스크"),
      ...(DATA.risks.length > 0
          ? DATA.risks.map(risk => bullet(risk))
          : [para("특이 리스크 없음")]),
      spacer(200),

      // ── 6. 데이터 출처 ──
      heading1("6. 데이터 출처"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
          headerRow(["출처", "URL", "수집 항목"], [2800, 3000, 3560]),
          dataRow(["Upbit API", "api.upbit.com/v1/ticker", "BTC/ETH/XRP/SAND 시세"],
                  [2800,3000,3560], ["left","left","left"], false),
          dataRow(["한경 코리아마켓", "markets.hankyung.com", "코스피·코스닥 실시간"],
                  [2800,3000,3560], ["left","left","left"], true),
          dataRow(["한경 데이터센터", "datacenter.hankyung.com", "미국 증시 종가 (1차)"],
                  [2800,3000,3560], ["left","left","left"], false),
          dataRow(["Yahoo Finance", "finance.yahoo.com", "미국 증시 (2차 폴백)"],
                  [2800,3000,3560], ["left","left","left"], true),
          dataRow(["investing.com", "investing.com", "미국 증시 (3차 폴백)"],
                  [2800,3000,3560], ["left","left","left"], false),
          dataRow(["네이버 검색 MCP", "search.naver.com", "뉴스·이슈·테마"],
                  [2800,3000,3560], ["left","left","left"], true)
        ]
      })
    ]
  }]
});

// ── 저장 ─────────────────────────────────────
const dateCompact = DATE.replace(/\./g, '');
const timeCompact = TIME.replace(/:/g, '');
const OUTPUT = `/tmp/report-build/시장보고서_${dateCompact}_${timeCompact}.docx`;

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log(`Done: ${OUTPUT}`);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
```

## 주요 규칙

- 페이지 크기: `width: 12240, height: 15840` (US Letter, DXA 단위. 1인치 = 1440 DXA)
- 여백: 1080 DXA (약 0.75인치)
- 셰이딩: 항상 `ShadingType.CLEAR` 사용 (`SOLID`는 일부 Word 버전에서 렌더링 깨짐)
- 유니코드 불릿(•, ●) 사용 금지 — 텍스트 하이픈(`-`)으로 대체 (한글 폰트 fallback 이슈)
- 컬러값: 양수 등락 = `GREEN("006400")`, 음수 = `RED_DARK("C00000")` (한국 시장 관습 따름)
- 카테고리 행(`categoryRow`)은 `columnSpan: 5`로 5열 병합하여 시각적 구분 제공
