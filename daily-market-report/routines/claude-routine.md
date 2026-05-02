# Claude Routines 자동 실행 설정

이 문서는 `daily-market-report` 플러그인을 매일 **06:30 / 13:00 / 21:00 KST** 에 자동 실행하도록 Claude Routines를 설정하는 절차입니다.

---

## 사전 준비

다음이 모두 충족되어야 합니다:

| 항목 | 확인 방법 |
|------|----------|
| 플러그인 설치 | Claude Code에서 `daily-market-report` 플러그인이 활성화 상태 |
| Claude in Chrome 연결 | Settings > Connectors > Claude in Chrome 활성 |
| NaverSearch MCP 연결 | Settings > Connectors > NaverSearch 활성 |
| KakaotalkChat MCP 연결 | Settings > Connectors > KakaotalkChat 활성 |
| 카카오톡 "나에게 보내기" 사용 가능 | 카카오톡 앱에 본인 계정 로그인 |

Upbit API는 인증이 필요 없으므로 별도 설정 없음. bash 도구는 Claude Code 기본 제공.

---

## 루틴 등록 절차

### 방법 A: claude.ai 웹 UI

1. https://claude.ai 로그인
2. 우측 사이드바 또는 Settings → **Routines** 메뉴 진입
3. **New Routine** 클릭
4. 아래 3개 루틴을 동일한 방식으로 등록

### 방법 B: 모바일 앱

Settings → Routines → New Routine

---

## 등록할 3개 루틴

### 루틴 1: 오전 시장 보고

| 필드 | 값 |
|------|---|
| Name | `시장 보고서 오전 (06:30)` |
| Schedule | `Daily at 06:30` (Time zone: `Asia/Seoul`) |
| Prompt | 아래 [공통 프롬프트] 참조 |
| Project | (선택 사항) `daily-market-report` 전용 프로젝트 |

### 루틴 2: 점심 시장 보고

| 필드 | 값 |
|------|---|
| Name | `시장 보고서 점심 (13:00)` |
| Schedule | `Daily at 13:00` (Time zone: `Asia/Seoul`) |
| Prompt | 아래 [공통 프롬프트] 참조 |

### 루틴 3: 저녁 시장 보고

| 필드 | 값 |
|------|---|
| Name | `시장 보고서 저녁 (21:00)` |
| Schedule | `Daily at 21:00` (Time zone: `Asia/Seoul`) |
| Prompt | 아래 [공통 프롬프트] 참조 |

---

## 공통 프롬프트

세 루틴 모두 다음 프롬프트를 사용합니다 (복사해서 붙여넣으세요):

```
시장 보고서 만들어줘.

아래 절차를 정확히 따른다:
1. daily-market-report 플러그인의 generate-report 스킬을 즉시 호출한다
2. crypto-collector, chrome-collector, naver-collector 세 에이전트를 단일 메시지에 동시 호출하여 병렬 수집한다
3. references/docx-template.md 규격에 따라 docx 보고서를 생성한다
4. 워킹 폴더에 시장보고서_YYYYMMDD_HHMM.docx 형태로 저장한다
5. references/kakao-template.md 규격에 따라 trigger 시각에 맞는 템플릿(morning/midday/evening 자동 판별)으로 카카오톡으로 발송한다
6. 완료 후 작업 결과를 요약해서 출력한다

주의:
- 세 에이전트는 반드시 병렬 실행한다 (순차 실행 금지)
- 일부 데이터 수집 실패 시에도 보고서는 완성하여 발송한다
- 카톡 발송 실패 시 메시지 내용을 채팅에 출력한다
```

---

## Cron 표기 (참고용)

Claude Routines가 cron 형식을 지원하는 경우:

```cron
# 오전
30 6 * * *   Asia/Seoul

# 점심
0 13 * * *   Asia/Seoul

# 저녁
0 21 * * *   Asia/Seoul
```

---

## 검증 절차

1. **수동 트리거 테스트**: 루틴 등록 후 "Run now" 버튼으로 즉시 실행 → 카톡 도착 + 워킹폴더에 docx 생성 확인
2. **시각 정확도 확인**: 다음 예약 시각(예: 익일 06:30) 1분 전부터 카톡 알림 대기 → 06:30 ± 2분 이내 도착 정상
3. **3-way 병렬성 확인**: Claude의 작업 로그에서 세 Agent 호출이 동일 timestamp에 시작되는지 확인 (timestamp 차이 1초 이내)
4. **폴백 동작 확인**: 한경 사이트가 점검 중일 때 보고서 출처에 `(yahoo)` 또는 `(investing)` 표기되는지 확인

---

## 트러블슈팅

| 증상 | 원인 | 조치 |
|------|------|------|
| 카톡이 도착하지 않음 | KakaotalkChat MCP 인증 만료 | Settings > Connectors > KakaotalkChat 재연결 |
| 도착 시각이 1시간 어긋남 | Time zone 설정 누락 | 루틴 편집 → Time zone을 `Asia/Seoul`로 명시 |
| docx 파일이 깨짐 | npm 캐시 누락 | 한 번 수동 실행하여 `/tmp/report-build`에 docx 패키지 캐시 형성 |
| 미국 증시 데이터 누락 | 한경 1차 + Yahoo 2차 모두 차단 | chrome-collector.md의 폴백 체인을 검토하고 investing.com URL 갱신 |
| 암호화폐 데이터 누락 | Upbit 점검(보통 새벽 03:00 ~ 04:00) | 점검 종료 후 자동 복구. 06:30 트리거는 영향권 밖 |
| 보고서가 비어있음 | 모든 에이전트 실패 | 트리거 시각의 네트워크 상태 확인 |

---

## 일시 중단·재개

- **휴가 등 일시 중단**: 루틴 편집 → `Pause` 토글
- **삭제**: 루틴 우측 메뉴 → `Delete`
- **수정**: 시각·프롬프트 변경 시 즉시 반영. 진행 중인 실행에는 영향 없음

---

## 비용 참고

3개 루틴 × 30일 = 월 90회 실행. 1회당 평균:
- 입력 토큰: 약 8,000 (3 에이전트 + docx 템플릿 + 카톡 템플릿)
- 출력 토큰: 약 3,000 (수집 데이터 + 보고서 텍스트 + 카톡 메시지)
- Web fetch: 약 5~7회 (한경 + Yahoo 폴백 + investing 폴백)
- MCP 호출: 약 12회 (NaverSearch 9회 + KakaotalkChat 1회 + Upbit 직접 1회)

월간 토큰 사용량은 사용자 플랜의 일일 한도 기준으로 확인 권장.
