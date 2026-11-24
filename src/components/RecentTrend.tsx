import { formatCount } from '../lib/congestion';
import { timeCoords, timePoints, timeSegments, type HistoryPoint } from '../lib/history';

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
 * 실제 경과시간 x축. 수집 공백은 선·면을 분리하고 캡션으로 알린다.
 */
export default function RecentTrend({ points: rawPoints, width = 340, height = 120 }: RecentTrendProps) {
  const points = timePoints(rawPoints);
  if (points.length === 0) {
    return (
      <p className="muted">
        측정이 쌓이는 중입니다. 30분마다 자동 수집해 하루치가 차면 완전한 곡선이 됩니다.
      </p>
    );
  }

  const pad = 8;
  const coords = timeCoords(points, width, height, pad);
  const segments = timeSegments(points);
  let offset = 0;
  const paths = segments.map(segment => {
    const part = coords.slice(offset, offset + segment.length);
    offset += segment.length;
    return { part, line: part.map(c => `${c.x},${c.y}`).join(' ') };
  });
  const gaps = segments.length - 1;
  const regular = points.length > 1 && points.slice(1).every((p, i) => p.t - points[i].t === 30 * 60 * 1000);
  const last = coords[coords.length - 1];
  const counts = points.map((p) => p.count);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const maxAt = points[counts.indexOf(max)];
  const minAt = points[counts.indexOf(min)];


  return (
    <figure className="trend">
      <div className="trend-chart">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`최근 24시간 주차대수 추이: 최대 ${formatCount(max)}대(${formatDayClock(maxAt.t)}), 최소 ${formatCount(min)}대(${formatDayClock(minAt.t)}). 측정 ${points.length}회. 실제 경과시간 축, 표시 데이터 공백 ${gaps}곳`}
        >
          {paths.map(({part,line}, i) => part.length > 1 ? (
            <g key={i}>
              <polygon points={`${part[0].x},${height-pad} ${line} ${part[part.length-1].x},${height-pad}`} className="trend-area" />
              <polyline points={line} className="trend-line" />
            </g>
          ) : <circle key={i} cx={part[0].x} cy={part[0].y} r="3" className="trend-dot" />)}
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
        <span className="trend-caption-right">{regular ? '30분 간격' : '실제 시간축'} · 측정 {points.length}회</span>
        {gaps > 0 && <span>표시 데이터 공백 {gaps}곳: 45분 초과 구간은 선을 연결하지 않습니다. 수집 중단 여부는 이 그래프만으로 알 수 없습니다.</span>}
      </figcaption>
    </figure>
  );
}
