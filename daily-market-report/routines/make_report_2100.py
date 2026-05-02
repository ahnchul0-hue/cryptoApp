# -*- coding: utf-8 -*-
"""저녁 보고서 (2026-05-01 21:00 KST) 생성 스크립트."""
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = r"C:\Users\ahnchul0\.claude\plugins\daily-market-report\시장보고서_20260501_2100.docx"

RED  = RGBColor(0xC0, 0x39, 0x2B)
BLUE = RGBColor(0x1F, 0x4E, 0x9C)
BLACK= RGBColor(0x00, 0x00, 0x00)
GRAY = RGBColor(0x55, 0x55, 0x55)

def set_korean_font(run, size=10, bold=False, color=None):
    run.font.name = "맑은 고딕"
    run._element.rPr.rFonts.set(qn('w:eastAsia'), '맑은 고딕')
    run.font.size = Pt(size)
    run.bold = bold
    if color is not None:
        run.font.color.rgb = color

def add_para(doc, text, size=10, bold=False, color=None, align=None, space_after=2):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    p.paragraph_format.space_after = Pt(space_after)
    r = p.add_run(text)
    set_korean_font(r, size=size, bold=bold, color=color)
    return p

def add_heading(doc, text, level=1):
    sizes = {1: 16, 2: 13, 3: 11}
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(text)
    set_korean_font(r, size=sizes.get(level, 11), bold=True, color=BLACK)
    return p

def color_for(pct):
    if pct > 0: return RED
    if pct < 0: return BLUE
    return BLACK

def fmt_pct(pct):
    return f"{pct:+.2f}%"

def fmt_int(n):
    return f"{n:,}"

def add_market_table(doc, rows, headers):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Light Grid Accent 1"
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = ""
        p = hdr[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h)
        set_korean_font(r, size=10, bold=True, color=BLACK)
    for row_data in rows:
        cells = table.add_row().cells
        for i, (text, color, bold) in enumerate(row_data):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i > 0 else WD_ALIGN_PARAGRAPH.LEFT
            r = p.add_run(text)
            set_korean_font(r, size=10, bold=bold, color=color)
    return table

# ──────────────────────────────────────────────────────────────────
# 데이터
# ──────────────────────────────────────────────────────────────────

DATE = "2026.05.01"
TIME = "21:00"
TRIGGER_LABEL = "저녁 보고 (한국 마감 + 미국 개장 직전)"

crypto = {
    "btc":  {"price": 116115000, "change":  2305000, "changePct":  2.03, "high": 116777000, "low": 113751000, "volume": 117504352453},
    "eth":  {"price":   3421000, "change":    53000, "changePct":  1.57, "high":   3441000, "low":   3364000, "volume":  51121320150},
    "xrp":  {"price":      2067, "change":       30, "changePct":  1.47, "high":      2073, "low":      2036, "volume":  61468039041},
    "sand": {"price":       108, "change":        1, "changePct":  0.93, "high":       109, "low":       107, "volume":   1969709445},
}

korean = {
    "kospi":  {"price": 6598.87, "change": -92.30, "changePct": -1.38, "source": "한국거래소", "note": "4/30 마감 (5/1 근로자의 날 휴장)"},
    "kosdaq": {"price": None,    "change": None,   "changePct": -2.0,  "source": "복수 보도",   "note": "4/30 2%대 하락 (정확 종가 보도 미확정)"},
    "topStocks": [
        ("삼성전자",  None, "1Q 매출 133조 사상 최대"),
        ("LG전자",    None, "4월 +27%, 엔비디아 협업 모멘텀"),
        ("LS일렉트릭", None, "4월 개인 순매수 1위, 전력 인프라"),
        ("SK하이닉스", None, "AI 메모리 슈퍼사이클 지속"),
    ],
}

us = {
    "sp500":  {"price": 7209.01,  "change":   73.06, "changePct": 1.02, "source": "CNBC/한국경제", "marketStatus": "previous_close"},
    "nasdaq": {"price": 24892.31, "change":  219.07, "changePct": 0.89, "source": "CNBC/한국경제", "marketStatus": "previous_close"},
    "dow":    {"price": 49652.14, "change":  790.33, "changePct": 1.62, "source": "CNBC/한국경제", "marketStatus": "previous_close"},
}

macro = {
    "oil":    "WTI 배럴당 약 $105~108 (중동 리스크 지속, 4거래일 연속 강세)",
    "dollar": "원/달러 1,483.3원 (전일 대비 +4.30원, 1480원대 고착화)",
    "rate":   "美 10년물 4.38% (3bp↓), 빅테크 호실적 영향으로 위험선호 회귀",
    "gold":   "달러·BTC 강세에 비해 상대적 부진, 4월 조정 마무리 흐름",
}

crypto_issues = [
    "비트코인 7만7천 달러대 박스권, 8만 달러 저항 미돌파 — 4억5,794만 달러 청산 후 4시간 숏스퀴즈",
    "이더리움 2,260~2,280달러 횡보, 알트 대장 회복 시도하나 ETF 자금 이탈 부담",
    "리플(XRP) 1.35~1.40달러 박스권, 사업 호조에도 유가 급등·금리 우려에 1달러 추락 경계론",
    "비트코인 현물 ETF 3거래일 연속 자금 유출, 기관 매수세 약화",
    "Upbit KRW 마켓 4종(BTC/ETH/XRP/SAND) 모두 +1~2% 동반 반등, 김치프리미엄 소폭 확대 가능성",
]

korean_issues = [
    "코스피 6,598.87 (-1.38%) 4거래일 만에 하락, 외국인 1.4조원 순매도 — 코스닥은 2%대 동반 급락",
    "4월 한 달 코스피 누적 +30.6% 급등, 7,000선 진입 모멘텀과 단기 차익 실현 욕구 충돌",
    "삼성전자 1Q 매출 133조원 사상 최대, AI 메모리 슈퍼사이클로 반도체 풀매수 외국인 vs 인버스 개미 수익률 +51% / -47% 양극화",
    "외국인 전기·전자 업종 중심 대규모 순매도 지속, 5월 첫주 변동성 장세 우려",
    "5월 1일 근로자의 날 휴장 — 다음 거래일은 5월 4일(월), 재개장 시 미국 빅테크 호실적 반영 기대",
]

us_issues = [
    "S&P500 7,209.01 (+1.02%) 사상 최고치 첫 7,200 돌파, 4월 월간 상승률 2020년 이후 최고",
    "다우 49,652.14 (+1.62%, +790p) 압도적 강세 — 알파벳 +10%, 애플 깜짝 실적 견인",
    "나스닥 24,892.31 (+0.89%) 사상 최고, 빅테크 4사 연간 설비투자 합계 1,070조원 발표로 AI 사이클 재확인",
    "FOMC 기준금리 3.50~3.75% 3회 연속 동결, 34년 만에 반대표 4명 — 연준 내 균열 부각",
    "美 10년물 국채금리 4.38% (-3bp) 안정, 빅테크 호실적이 중동 리스크·매파 우려를 흡수",
    "전쟁 중에도 사상최고치 — 시장은 '전쟁 피로감' 속 AI 모멘텀에 베팅",
]

analysis = {
    "momentum": "美 빅테크 호실적이 중동 리스크·매파 연준 우려를 압도, 글로벌 위험자산은 5월 첫 거래일 강세 출발 — 한국은 휴장으로 다음 거래일에 반영 예정.",
    "cryptoChar": [
        "Upbit KRW 4종 모두 +1~2% 반등, 거시 호재(빅테크) 동조화",
        "BTC 8만 달러 저항 미돌파로 박스권 상단 시험 — 2분기 모멘텀 분기점",
        "ETF 자금 이탈은 진행 중이나 현물 매수가 하단을 지지",
    ],
    "koreanChar": [
        "코스피 단기 조정(-1.38%) 후 7,000선 재진입 시도 vs 외국인 매도 지속 우려",
        "AI·반도체 슈퍼사이클(삼성전자·SK하이닉스·LG전자) 견조, 종목 차별화 심화",
        "근로자의 날 휴장 — 5/4 재개장 시 미국 사상최고 효과 일괄 반영 가능",
    ],
    "usChar": [
        "4월 사상 최고 마감 + 5월 첫 거래일 강세 출발 — 모멘텀 강화",
        "빅테크 깜짝 실적(알파벳·애플·아마존)이 광범위 매수세 견인",
        "FOMC 동결 + 반대표 4명 — 7~9월 인하 재가격 가능성",
    ],
    "risks": [
        "중동 긴장(美·이란) 지속, WTI 배럴당 105~108달러 고착으로 인플레 재점화 위험",
        "원/달러 1,480원대 고착 → 외국인 한국 자산 환손실 부담",
        "메타 등 일부 빅테크 가이던스 부진 — 종목 선별 장세 심화",
    ],
}

# 야간 모니터링 포인트 (저녁 보고 전용)
night_watch = "美 5월 1일(현지) 정규장 추가 동력 점검 — S&P500 7,250 돌파 여부, 알파벳·애플 갭 유지 여부, WTI 100달러대 안정 여부."

# ──────────────────────────────────────────────────────────────────
# 문서 생성
# ──────────────────────────────────────────────────────────────────

doc = Document()

for section in doc.sections:
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.8)
    section.left_margin = Cm(1.8)
    section.right_margin = Cm(1.8)

# 표지
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
title.paragraph_format.space_after = Pt(2)
r = title.add_run("일일 시장 보고서")
set_korean_font(r, size=22, bold=True, color=BLACK)

sub = doc.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
sub.paragraph_format.space_after = Pt(0)
r = sub.add_run(f"{DATE}  {TIME} KST  ·  {TRIGGER_LABEL}")
set_korean_font(r, size=11, bold=False, color=GRAY)

doc.add_paragraph()  # spacer

# Executive Summary
add_heading(doc, "Executive Summary", level=1)
add_para(doc, analysis["momentum"], size=11, color=BLACK, space_after=6)
add_para(doc, f"야간 모니터링 포인트: {night_watch}", size=10, bold=True, color=RED, space_after=10)

# 1. 암호화폐
add_heading(doc, "1. 암호화폐 (Upbit KRW 마켓)", level=2)
crypto_rows = []
for name, key in [("BTC","btc"), ("ETH","eth"), ("XRP","xrp"), ("SAND","sand")]:
    d = crypto[key]
    pct = d["changePct"]
    color = color_for(pct)
    crypto_rows.append([
        (name, BLACK, True),
        (fmt_int(d["price"]) + " KRW", color, True),
        (fmt_pct(pct), color, True),
        (fmt_int(d["high"]), GRAY, False),
        (fmt_int(d["low"]), GRAY, False),
        (f"{d['volume']/100000000:,.0f}억", GRAY, False),
    ])
add_market_table(doc, crypto_rows, ["종목","현재가(KRW)","변동률","24h 고가","24h 저가","24h 거래대금"])
doc.add_paragraph()

add_para(doc, "주요 이슈", size=11, bold=True, color=BLACK, space_after=2)
for it in crypto_issues:
    add_para(doc, f"• {it}", size=10, color=BLACK, space_after=2)

# 2. 한국 증시
add_heading(doc, "2. 한국 증시 (4/30 마감 · 5/1 휴장)", level=2)
kospi = korean["kospi"]
kosdaq = korean["kosdaq"]
korean_rows = [
    [("KOSPI", BLACK, True),
     (f"{kospi['price']:,.2f}", color_for(kospi["changePct"]), True),
     (f"{kospi['change']:+,.2f}", color_for(kospi["changePct"]), False),
     (fmt_pct(kospi["changePct"]), color_for(kospi["changePct"]), True),
     (kospi["note"], GRAY, False)],
    [("KOSDAQ", BLACK, True),
     ("정보 없음", GRAY, False),
     ("정보 없음", GRAY, False),
     ("약 -2%대", color_for(kosdaq["changePct"]), True),
     (kosdaq["note"], GRAY, False)],
]
add_market_table(doc, korean_rows, ["지수","종가","등락폭","등락률","비고"])
doc.add_paragraph()

add_para(doc, "오늘의 종목·테마", size=11, bold=True, color=BLACK, space_after=2)
for name, _, note in korean["topStocks"]:
    add_para(doc, f"• {name} — {note}", size=10, color=BLACK, space_after=2)

doc.add_paragraph()
add_para(doc, "주요 이슈", size=11, bold=True, color=BLACK, space_after=2)
for it in korean_issues:
    add_para(doc, f"• {it}", size=10, color=BLACK, space_after=2)

# 3. 미국 증시
add_heading(doc, "3. 미국 증시 (4/30 종가 · 美 5/1 개장 전)", level=2)
us_rows = []
for name, key in [("S&P 500","sp500"), ("NASDAQ","nasdaq"), ("DOW","dow")]:
    d = us[key]
    color = color_for(d["changePct"])
    us_rows.append([
        (name, BLACK, True),
        (f"{d['price']:,.2f}", color, True),
        (f"{d['change']:+,.2f}", color, False),
        (fmt_pct(d["changePct"]), color, True),
        ("전일 종가", GRAY, False),
    ])
add_market_table(doc, us_rows, ["지수","종가","등락폭","등락률","상태"])
doc.add_paragraph()

add_para(doc, "주요 이슈", size=11, bold=True, color=BLACK, space_after=2)
for it in us_issues:
    add_para(doc, f"• {it}", size=10, color=BLACK, space_after=2)

# 4. 거시경제
add_heading(doc, "4. 거시경제 지표", level=2)
macro_rows = [
    [("국제유가",  BLACK, True), (macro["oil"], BLACK, False)],
    [("환율",      BLACK, True), (macro["dollar"], BLACK, False)],
    [("美 10년물", BLACK, True), (macro["rate"], BLACK, False)],
    [("금가격",    BLACK, True), (macro["gold"], BLACK, False)],
]
add_market_table(doc, macro_rows, ["지표","현황"])

# 5. 종합 분석
add_heading(doc, "5. 종합 분석 및 전략 포인트", level=2)

add_para(doc, "글로벌 모멘텀", size=11, bold=True, color=BLACK, space_after=2)
add_para(doc, analysis["momentum"], size=10, color=BLACK, space_after=8)

add_para(doc, "암호화폐 특징", size=11, bold=True, color=BLACK, space_after=2)
for c in analysis["cryptoChar"]:
    add_para(doc, f"• {c}", size=10, color=BLACK, space_after=2)

doc.add_paragraph()
add_para(doc, "한국 증시 특징", size=11, bold=True, color=BLACK, space_after=2)
for c in analysis["koreanChar"]:
    add_para(doc, f"• {c}", size=10, color=BLACK, space_after=2)

doc.add_paragraph()
add_para(doc, "미국 증시 특징", size=11, bold=True, color=BLACK, space_after=2)
for c in analysis["usChar"]:
    add_para(doc, f"• {c}", size=10, color=BLACK, space_after=2)

doc.add_paragraph()
add_para(doc, "주요 리스크", size=11, bold=True, color=RED, space_after=2)
for c in analysis["risks"]:
    add_para(doc, f"• {c}", size=10, color=BLACK, space_after=2)

# 6. 야간 모니터링 포인트
add_heading(doc, "6. 야간 모니터링 포인트 (美 22:30 KST 개장 후)", level=2)
add_para(doc, night_watch, size=11, bold=True, color=RED, space_after=4)
add_para(doc, "• S&P500 7,250 돌파 시 — 7,300 추가 모멘텀 / 미돌파 시 — 차익 실현 압력", size=10, color=BLACK, space_after=2)
add_para(doc, "• 알파벳 +10% 갭 유지 여부 = 빅테크 신뢰도 바로미터", size=10, color=BLACK, space_after=2)
add_para(doc, "• WTI 100달러 하향 안정 시 — 인플레 우려 완화 / 110달러 재돌파 시 — 위험회피 재점화", size=10, color=BLACK, space_after=2)
add_para(doc, "• 한국 5/4 재개장 — 외국인 순매수 전환 여부 핵심", size=10, color=BLACK, space_after=2)

# 푸터
doc.add_paragraph()
foot = add_para(doc, f"본 보고서는 {DATE} {TIME} KST 기준 자동 수집 데이터로 작성되었습니다. (소스: Upbit API, CNBC, 한국경제, 연합뉴스, 네이버뉴스 등)", size=9, color=GRAY, align=WD_ALIGN_PARAGRAPH.CENTER)

doc.save(OUT)
print(f"OK {OUT}")
