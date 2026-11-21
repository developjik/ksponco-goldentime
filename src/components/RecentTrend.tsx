import { formatCount } from '../lib/congestion';
import { sparkCoords, type HistoryPoint } from '../lib/history';

export interface RecentTrendProps {
  points: HistoryPoint[];
  width?: number;
  height?: number;
}

/** epoch(ms) → "M/D HH:mm"(하루를 넘는 24시간 구간 표시용). */
function formatDayClock(ts: number): string {
  const d = new Date(ts);
  const two = (v: number) => v.toString().padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/**
 * 최근 24시간 추이(인라인 SVG): 라인 + 옅은 면적.
 * 세션 스파크라인과 같은 좌표 계산을 쓰되, 캡션은 24시간 창 문맥(구간·최대·최소)을 담는다.
 */
export default function RecentTrend({ points, width = 340, height = 120 }: RecentTrendProps) {
  if (points.length < 2) {
    return (
      <p className="muted">
        측정이 쌓이는 중입니다. 30분마다 자동 수집해 하루치가 차면 완전한 곡선이 됩니다.
      </p>
    );
  }

  const pad = 8;
  const coords = sparkCoords(points, width, height, pad);
  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const last = coords[coords.length - 1];
  const counts = points.map((p) => p.count);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const maxAt = points[counts.indexOf(max)];
  const minAt = points[counts.indexOf(min)];
  const areaPoints = `${pad},${height - pad} ${linePoints} ${last.x},${height - pad}`;

  return (
    <figure className="trend">
      <div className="trend-chart">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`최근 24시간 주차대수 추이: 최대 ${formatCount(max)}대(${formatDayClock(maxAt.t)}), 최소 ${formatCount(min)}대(${formatDayClock(minAt.t)}). 측정 ${points.length}회`}
        >
          <polygon points={areaPoints} className="trend-area" />
          <polyline points={linePoints} className="trend-line" />
          <circle cx={last.x} cy={last.y} r="4" className="trend-dot" />
        </svg>
        <span className="trend-max" aria-hidden="true">
          최대 {formatCount(max)}대
        </span>
        <span className="trend-min" aria-hidden="true">
          최소 {formatCount(min)}대
        </span>
      </div>
      <figcaption className="trend-caption">
        <span>
          {formatDayClock(points[0].t)} ~ {formatDayClock(points[points.length - 1].t)}
        </span>
        <span className="trend-caption-right">30분 간격 · 측정 {points.length}회</span>
      </figcaption>
    </figure>
  );
}
