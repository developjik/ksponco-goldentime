import { Link } from 'react-router-dom';
import Gauge from '../components/Gauge';
import Sparkline from '../components/Sparkline';
import { useParking } from '../hooks/useParking';
import { formatClock } from '../lib/congestion';

export default function Home() {
  const { snapshot, history, loading, error, refresh } = useParking();

  return (
    <section>
      <h1>지금 올림픽공원</h1>
      <p>한국체육산업개발(주) 실시간 주차현황 기반, 전체 주차장 혼잡 한눈에 보기.</p>

      <div className="card">
        {snapshot ? (
          <>
            <Gauge parked={snapshot.parkedTotal} />
            <div className="refresh-row">
              <span className="meta-text">
                마지막 업데이트 {formatClock(snapshot.fetchedAt)} · 1분마다 자동 갱신
              </span>
              <button type="button" onClick={refresh} disabled={loading}>
                {loading ? '불러오는 중…' : '지금 새로고침'}
              </button>
            </div>
            {error && (
              <p role="alert" className="error-text">
                최신 갱신에 실패했습니다 ({error}). 마지막 값을 표시하는 중입니다.
              </p>
            )}
          </>
        ) : loading ? (
          <p>실시간 주차현황을 불러오는 중…</p>
        ) : (
          <div role="alert" className="error-block">
            <p className="error-text">
              실시간 주차현황을 가져오지 못했습니다.
              {error ? ` (${error})` : ''}
            </p>
            <button type="button" onClick={refresh}>
              다시 시도
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>세션 내 추이</h2>
        <Sparkline points={history} />
        <p className="meta-text">
          그래프는 이번 방문 중 수집된 측정값만 담습니다 — 페이지를 새로고침하면 초기화됩니다.
        </p>
      </div>

      <div className="card card-cta">
        <h2>골든타임 예측·히트맵</h2>
        <p>
          시간대별 혼잡 히트맵과 입장 최적 시간(골든타임) 예측을 준비 중입니다.
          <br />
          공공데이터포털 데이터 활용 승인 후 순차 공개됩니다.
        </p>
        <Link to="/predict" className="link-button">
          준비 상황 보기
        </Link>
      </div>
    </section>
  );
}
