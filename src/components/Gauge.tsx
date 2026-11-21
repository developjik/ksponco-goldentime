import {
  TOTAL_CAPACITY,
  congestionLevel,
  formatCount,
  occupancyPercent,
  type CongestionLevel,
} from '../lib/congestion';

const LEVEL_CLASS: Record<CongestionLevel, string> = {
  여유: 'level-good',
  보통: 'level-normal',
  혼잡: 'level-busy',
  '매우 혼잡': 'level-severe',
};

export interface GaugeProps {
  /** 현재 전체 주차대수 */
  parked: number;
}

/** 실시간 전체 혼잡 게이지: 숫자 + 재차율 진행 막대 + 단계 배지. */
export default function Gauge({ parked }: GaugeProps) {
  const percent = occupancyPercent(parked);
  const level = congestionLevel(percent);
  // 재차율 100% 초과(집계 기준 총면수 초과)에도 막대는 100%에서 잘라 표시.
  const barWidth = Math.min(percent, 100);

  return (
    <div className="gauge" role="group" aria-label="실시간 전체 주차 혼잡">
      <div className="gauge-top">
        <p className="gauge-number">
          {formatCount(parked)}
          <span className="gauge-unit">대</span>
        </p>
        <span className={`level-badge ${LEVEL_CLASS[level]}`}>{level}</span>
      </div>
      <div
        className="gauge-bar"
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`전체 주차장 재차율 ${percent}% (${level})`}
      >
        <div className={`gauge-fill ${LEVEL_CLASS[level]}`} style={{ width: `${barWidth}%` }} />
      </div>
      <p className="gauge-caption">
        전체 수용 능력 약 {formatCount(TOTAL_CAPACITY)}대 기준 재차율{' '}
        <strong>{percent}%</strong>
      </p>
    </div>
  );
}
