import { useEffect, useReducer } from 'react';
import { RefreshIcon } from './Icons';
import {
  TOTAL_CAPACITY,
  congestionLevel,
  formatCount,
  occupancyPercent,
  type CongestionLevel,
} from '../lib/congestion';

const LEVEL_CLASS: Record<CongestionLevel, string> = {
  여유: 'lv-good',
  보통: 'lv-normal',
  혼잡: 'lv-busy',
  '매우 혼잡': 'lv-severe',
};

/** 재차율 단계 경계(%) — 게이지 눈금과 안내 페이지 기준이 같음을 보여준다. */
const THRESHOLDS = [40, 70, 85];

export interface GaugePanelProps {
  parked: number;
  lastAt: number;
  pollMs: number;
  loading: boolean;
  onRefresh: () => void;
}

/**
 * 실시간 상태 패널(다크 계기판).
 * 운전자가 먼저 보는 값은 '빈 자리'다 — 주차대수·재차율은 보조로 배치한다.
 * 남은 시간은 1초 틱으로 갱신: "N초 후 자동 갱신".
 */
export default function GaugePanel({ parked, lastAt, pollMs, loading, onRefresh }: GaugePanelProps) {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const percent = occupancyPercent(parked);
  const level = congestionLevel(percent);
  const spotsLeft = Math.max(TOTAL_CAPACITY - parked, 0);
  const barWidth = Math.min(percent, 100);
  const secLeft = Math.max(0, Math.ceil((lastAt + pollMs - Date.now()) / 1000));

  return (
    <section className="hero" aria-label="올림픽공원 전체 주차장 실시간 상태">
      <div className="hero-head">
        <p className="hero-label">올림픽공원 전체 주차장</p>
        <span className={`hero-badge ${LEVEL_CLASS[level]}`}>{level}</span>
      </div>

      <p className="hero-main">
        빈 자리 <strong>{formatCount(spotsLeft)}</strong>대
        <span className="hero-sub">약 {formatCount(TOTAL_CAPACITY)}대 중</span>
      </p>

      <div className="hero-gauge" aria-hidden="true">
        <div className="hero-gauge-track">
          <div className={`hero-gauge-fill ${LEVEL_CLASS[level]}`} style={{ width: `${barWidth}%` }} />
          {THRESHOLDS.map((t) => (
            <span key={t} className="hero-gauge-tick" style={{ left: `${t}%` }} />
          ))}
        </div>
        <div className="hero-gauge-scale">
          <span>0</span>
          <span>주차율 {percent}%</span>
          <span>100</span>
        </div>
      </div>

      <p className="hero-figure" role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`주차율 ${percent}%, ${level}. 현재 주차된 차 ${formatCount(parked)}대`}>
        현재 주차된 차 <strong>{formatCount(parked)}</strong>대 · 주차율 {percent}%
      </p>

      <div className="hero-actions">
        <span className="hero-clock">
          {loading ? '업데이트 중…' : `${secLeft}초 후 자동 갱신`}
        </span>
        <button
          type="button"
          className="hero-refresh"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshIcon className={loading ? 'spin' : undefined} />
          새로고침
        </button>
      </div>
    </section>
  );
}
