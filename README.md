# 올팍 골든타임

올림픽공원 전체 주차장의 실시간 혼잡과 빈 자리를 보여 주고, 과거 실측으로 가장 한산한
시간대(골든타임)를 알려주는 웹 서비스. KSPONCO 공공데이터 활용 경진대회 아이템 1 출품작.

- 서비스: <https://developjik.github.io/ksponco-goldentime/>
- 기술: Vite 5 · React 18 · TypeScript, GitHub Actions로 GitHub Pages 배포

## 기능

- **실시간**: 한국체육산업개발(주) 공개 실시간 주차현황 API를 60초 간격으로 조회해 빈 자리
  수(약 2,800대 기준)와 주차율·혼잡 단계를 계기판 형태로 표시.
- **방문 중 추이**: 세션에서 수집한 주차대수의 스파크라인.
- **골든타임 예측·히트맵**: 공공데이터포털 시간별 연계 데이터(2025년)를 요일×시간 평균
  주차율로 집산해 히트맵과 요일별 골든타임을 제공(집산 결과는 `public/data/pattern-2025.json`).

## 데이터

| 데이터 | 출처 |
| --- | --- |
| 실시간 전체 주차대수 | 한국체육산업개발(주) 올림픽공원 실시간 주차현황 공개 API |
| 전체 수용 능력 약 2,800대 | 올림픽공원 홈페이지 자주하는 질문 |
| 요일×시간 패턴 | 공공데이터포털 한국체육산업개발주식회사_실시간 주차현황 연계(API_CPM_009) |

혼잡 단계 경계(여유<40≤보통<70≤혼잡<85≤매우 혼잡, 주차율 %)는 이 서비스의 자체 기준.

## 개발

```bash
npm install
npm test        # 단위테스트(vitest)
npm run dev     # 개발 서버(5178)
npm run build   # tsc -b && vite build
npm run preview # 프로덕션 프리뷰(4178)
```

## 자동화(GitHub Actions)

- `deploy.yml` — main push·데이터 워크플로 완료 시 Pages 배포.
- `refresh-history.yml` — 30분마다 공개 실시간 API를 호출해 `data/realtime-history.json`에
  측정값 축적(키 불필요).
- `aggregate-2025.yml` — 수동 실행. `KSPONCO_LINK_API_KEY` 시크릿으로 연계 데이터를 전수
  수집·집산해 `public/data/pattern-2025.json` 갱신(원문 저장 없음, 집산물만).
