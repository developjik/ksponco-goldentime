import { formatClock, formatCount, formatDelta } from '../lib/congestion';
import { lastChange, netChange, sparkCoords, type HistoryPoint } from '../lib/history';

export interface SparklineProps {
  points: HistoryPoint[];
  width?: number;
  height?: number;
}

/**
 * 세션 내 추이(인라인 SVG): 라인 + 옅은 면적, 최댓값/최솟값 표시.
 * 포인트가 1개 이하면 안내 문구로 대체한다.
 */
export default function Sparkline({ points, width = 340, height = 120 }: SparklineProps) {
  if (points.length < 2) {
    return (
      <p className="muted">
        그래프는 측정이 2회 이상 쌓이면 나타납니다. 1분마다 자동 수집합니다.
      </p>
    );
  }

  const pad = 8;
  const coords = sparkCoords(points, width, height, pad);
  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const last = coords[coords.length - 1];
  const first = points[0];
  const net = netChange(points) ?? 0;
  const step = lastChange(points);
  const counts = points.map((p) => p.count);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const areaPoints = `${pad},${height - pad} ${linePoints} ${last.x},${height - pad}`;
  const stepLabel =
    step && step.dir !== 'flat'
      ? `직전 측정에서 ${formatDelta(step.amount)}대`
      : '직전 측정과 같음';

  return (
    <figure className="trend">
      <div className="trend-chart">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`세션 내 주차대수 추이: 관측 시작 후 ${formatDelta(net)}대, ${stepLabel}. 최대 ${formatCount(max)}대, 최소 ${formatCount(min)}대`}
        >
          <polygon points={areaPoints} className="trend-area" />
          <polyline points={linePoints} className="trend-line" />
          <circle cx={last.x} cy={last.y} r="4" className="trend-dot" />
        </svg>
        <span className="trend-max" aria-hidden="true">최대 {formatCount(max)}</span>
        <span className="trend-min" aria-hidden="true">최소 {formatCount(min)}</span>
      </div>
      <figcaption className="trend-caption">
        <span>
          {formatClock(first.t)} 관측 시작 후 <strong>{formatDelta(net)}대</strong>
        </span>
        <span className="trend-caption-right">
          {stepLabel} · 측정 {points.length}회
        </span>
      </figcaption>
    </figure>
  );
}
