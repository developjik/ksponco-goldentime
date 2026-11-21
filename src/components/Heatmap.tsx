import {
  WEEKDAY_LABELS,
  cellLevel,
  type HourCell,
  type ParkingPattern,
} from '../lib/pattern';
import { formatCount } from '../lib/congestion';

const LEVEL_CLASS: Record<string, string> = {
  여유: 'hm-good',
  보통: 'hm-normal',
  혼잡: 'hm-busy',
  '매우 혼잡': 'hm-severe',
};

/** 요일×시간 히트맵(7×24). null 칸은 운영시간 밖/무데이터로 비워 둔다. */
export default function Heatmap({ pattern }: { pattern: ParkingPattern }) {
  return (
    <div className="heatmap">
      <div className="heatmap-grid" role="img" aria-label={heatAria(pattern)}>
        {pattern.weekdayHour.map((hours, d) => (
          <div className="heatmap-row heatmap-row-live" key={d}>
            <span className="heatmap-day">{WEEKDAY_LABELS[d]}</span>
            {hours.map((cell, h) => (
              <span
                key={h}
                className={`heatmap-cell-live ${cell ? LEVEL_CLASS[cellLevel(cell, pattern.capacity)] : 'hm-none'}`}
                title={
                  cell
                    ? `${WEEKDAY_LABELS[d]} ${h}시 — 평균 ${formatCount(cell.avg)}대 (표본 ${cell.samples})`
                    : `${WEEKDAY_LABELS[d]} ${h}시 — 데이터 없음`
                }
              />
            ))}
          </div>
        ))}
        <div className="heatmap-row heatmap-hours">
          <span className="heatmap-day" />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h}>{h % 3 === 0 ? h : ''}</span>
          ))}
        </div>
      </div>
      <div className="heatmap-legend">
        <span><i className="dot hm-good" /> 여유</span>
        <span><i className="dot hm-normal" /> 보통</span>
        <span><i className="dot hm-busy" /> 혼잡</span>
        <span><i className="dot hm-severe" /> 매우 혼잡</span>
        <span className="muted small">2025년 평균 주차율 기준</span>
      </div>
    </div>
  );
}

function heatAria(pattern: ParkingPattern) {
  const cells = pattern.weekdayHour.flat().filter((c): c is HourCell => !!c);
  const avg = cells.length
    ? Math.round(cells.reduce((s, c) => s + c.avg, 0) / cells.length)
    : 0;
  return `요일×시간별 2025년 평균 주차대수 히트맵. 전체 칸 평균 ${formatCount(avg)}대.`;
}
