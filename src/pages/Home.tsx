import { Link } from 'react-router-dom';
import GaugePanel from '../components/Gauge';
import Sparkline from '../components/Sparkline';
import { ChevronIcon } from '../components/Icons';
import { POLL_MS, useParking } from '../hooks/useParking';

export default function Home() {
  const { snapshot, history, loading, error, refresh } = useParking();

  return (
    <div className="home">
      <h1 className="page-title">지금 올림픽공원</h1>

      {snapshot ? (
        <GaugePanel
          parked={snapshot.parkedTotal}
          lastAt={snapshot.fetchedAt}
          pollMs={POLL_MS}
          loading={loading}
          onRefresh={refresh}
        />
      ) : loading ? (
        <section className="hero hero-loading" aria-label="실시간 주차현황 불러오는 중">
          <p className="hero-label">올림픽공원 전체 주차장</p>
          <p className="hero-main skeleton-line" aria-label="불러오는 중">불러오는 중…</p>
          <p className="muted">한국체육산업개발(주) 실시간 주차현황에서 값을 가져오고 있습니다.</p>
        </section>
      ) : (
        <section className="hero hero-error" role="alert" aria-label="실시간 주차현황 오류">
          <p className="hero-label">올림픽공원 전체 주차장</p>
          <p className="hero-main">
            실시간 값을 가져오지 못했습니다
          </p>
          <p className="muted">{error ?? '네트워크 상태를 확인해 주세요.'}</p>
          <button type="button" className="hero-refresh" onClick={refresh}>
            다시 시도
          </button>
        </section>
      )}

      {snapshot && error && (
        <p role="status" className="notice">
          최근 갱신에 실패해 마지막 값을 표시하는 중입니다 ({error}).
        </p>
      )}

      <section className="panel" aria-labelledby="trend-title">
        <div className="panel-head">
          <h2 id="trend-title">방문 중 추이</h2>
          <span className="muted">이 탭에서만</span>
        </div>
        <Sparkline points={history} />
        <p className="muted small">
          이 그래프는 지금 이 페이지를 연 뒤 수집한 측정값만 담습니다. 페이지를 다시 열면 처음부터
          쌓입니다.
        </p>
      </section>

      <Link to="/predict" className="row-link">
        <span>
          <strong>골든타임 예측·히트맵</strong>
          <span className="muted small">2025년 실측 기반 — 요일별 골든타임·히트맵 보기</span>
        </span>
        <ChevronIcon />
      </Link>
    </div>
  );
}
