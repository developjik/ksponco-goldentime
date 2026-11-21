export default function Predict() {
  return (
    <div className="home">
      <h1 className="page-title">골든타임 예측·히트맵</h1>
      <p className="lede">
        언제 가장 빈자리가 많을지, 과거 기록으로 미리 알려주는 화면을 만들고 있습니다.
      </p>

      <section className="panel" aria-labelledby="data-title">
        <div className="panel-head">
          <h2 id="data-title">학습 데이터 현황</h2>
        </div>
        <ul className="data-list">
          <li className="data-row">
            <span className="data-name">2025년 입출차 기록</span>
            <span className="data-value">약 240만 건</span>
            <span className="data-state is-done">확보 완료</span>
          </li>
          <li className="data-row">
            <span className="data-name">시간별 연계 데이터</span>
            <span className="data-value">7,803건</span>
            <span className="data-state is-done">확보 완료</span>
          </li>
          <li className="data-row">
            <span className="data-name">실시간 주차현황</span>
            <span className="data-value">60초 간격</span>
            <span className="data-state is-live">서비스 중</span>
          </li>
        </ul>
        <p className="muted small">
          입출차 기록은 게이트(동2문·남2문·북2문)별 시각을 담고, 연계 데이터는 같은 시간의
          공연 관람객·날씨·방문객을 담습니다.
        </p>
      </section>

      <section className="panel" aria-labelledby="heatmap-title">
        <div className="panel-head">
          <h2 id="heatmap-title">요일×시간 히트맵</h2>
          <span className="data-state is-wip">집계 중</span>
        </div>
        <div className="heatmap-skeleton" aria-hidden="true">
          {Array.from({ length: 7 }, (_, d) => (
            <div className="heatmap-row" key={d}>
              {Array.from({ length: 24 }, (_, h) => (
                <span className="heatmap-cell" key={h} style={{ opacity: 0.18 + ((d * 24 + h) % 7) * 0.05 }} />
              ))}
            </div>
          ))}
        </div>
        <p className="muted small">
          확보한 기록을 요일·시간대별 빈자리로 집산하는 중입니다. 집계가 끝나면 이 자리에 실제
          히트맵이 표시되고, 각 요일의 골든타임이 함께 안내됩니다.
        </p>
      </section>
    </div>
  );
}
