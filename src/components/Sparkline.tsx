import { formatDelta } from '../lib/congestion';
import { lastChange, netChange, sparkCoords, type HistoryPoint } from '../lib/history';

export interface SparklineProps {
  points: HistoryPoint[];
  width?: number;
  height?: number;
}

/**
 * 세션 내 추이 스파크라인(인라인 SVG).
 * 포인트가 1개 이하면 안내 문구로 대체한다.
 */
export default function Sparkline({ points, width = 320, height = 96 }: SparklineProps) {
  if (points.length < 2) {
    return (
      <p className="meta-text">
        추이 그래프는 측정 포인트가 2개 이상부터 표시됩니다. 1분마다 자동 수집합니다.
      </p>
    );
  }

  const coords = sparkCoords(points, width, height);
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const last = coords[coords.length - 1];
  const net = netChange(points) ?? 0;
  const step = lastChange(points);
  const stepLabel =
    step && step.dir !== 'flat'
      ? `직전 측정 대비 ${formatDelta(step.amount)}대`
      : '직전 측정 대비 변동 없음';

  return (
    <figure className="sparkline">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`세션 내 주차대수 추이: 관측 시작 후 ${formatDelta(net)}대, ${stepLabel}`}
      >
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--blue)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={last.x} cy={last.y} r="4" fill="var(--blue)" />
      </svg>
      <figcaption className="meta-text">
        관측 시작 후 <strong>{formatDelta(net)}대</strong> · {stepLabel} · 측정 {points.length}회
      </figcaption>
    </figure>
  );
}
