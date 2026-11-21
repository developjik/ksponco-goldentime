export default function Predict() {
  return (
    <section>
      <h1>골든타임 예측·히트맵</h1>

      <div className="card placeholder-section">
        <p className="placeholder-badge">데이터 활용 신청 중</p>
        <p className="placeholder-title">이 섹션은 준비 중입니다</p>
        <p>
          시간대별·요일별 주차 수요 히트맵과 대기 없이 입장할 수 있는 골든타임 예측은{' '}
          <strong>공공데이터포털 「한국체육산업개발주식회사_실시간 주차현황」 OpenAPI</strong>{' '}
          데이터 활용 승인 후 제공됩니다. 승인이 나오면 이 자리가 바로 채워집니다.
        </p>
        <ul className="meta-list">
          <li>계획 1 — 입출차 기록 기반 시간대별 혼잡 히트맵</li>
          <li>계획 2 — 혼잡이 풀리는 시점(골든타임) 예측 안내</li>
          <li>계획 3 — 행사 일정과 겹쳐 보는 혼잡 리스크 표시</li>
        </ul>
      </div>

      <p className="meta-text">
        지금은 홈에서 실시간 전체 혼잡과 세션 내 추이를 확인할 수 있습니다.
      </p>
    </section>
  );
}
