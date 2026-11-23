import { useState } from 'react';
import {
  GOLDEN_TOP_K,
  defaultWeekday,
  MIN_CELL_SAMPLES,
  summaryLine,
  type BacktestCell,
  type BacktestResult,
} from '../lib/backtest';
import { OPEN_HOUR_END, OPEN_HOUR_START, WEEKDAY_LABELS } from '../lib/pattern';

export interface AccuracyCardProps {
  /** null = 실측 이력을 아직 못 불러옴(로딩·없음·오류) — "검증 중"으로 그린다 */
  result: BacktestResult | null;
  year: number;
}

/** 예측 정확도 카드: 백테스트 지표 + 선택 요일의 예측(선) vs 실측(점) 작은 차트. */
export default function AccuracyCard({ result, year }: AccuracyCardProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const verifying = !result || result.status === 'verifying';
  const weekday = picked ?? (result ? defaultWeekday(result) : null);
  const mae = !verifying ? result.mae : null;
  const rho = !verifying ? result.spearman : null;

  return (
    <section className="panel accuracy" aria-labelledby="acc-title" data-status={result?.status ?? 'verifying'}>
      <div className="panel-head">
        <h2 id="acc-title">예측 정확도</h2>
        <span className={`data-state ${verifying || result?.status === 'partial' ? 'is-wip' : 'is-done'}`}>
          {verifying ? '검증 중' : result?.status === 'partial' ? `검증 중 · ${result.weekdaysCovered}/7요일` : '검증 완료'}
        </span>
      </div>

      <dl className="acc-metrics">
        <div>
          <dt>주차율 오차(MAE)</dt>
          <dd className={mae === null ? 'is-gray' : ''}>{mae === null ? '—' : `${mae.toFixed(1)}%p`}</dd>
        </div>
        <div>
          <dt>순위 상관(ρ)</dt>
          <dd className={rho === null ? 'is-gray' : ''}>{rho === null ? '—' : rho.toFixed(2)}</dd>
        </div>
        <div>
          <dt>표본(n)</dt>
          <dd>{result ? result.n : 0}</dd>
        </div>
      </dl>

      {result && weekday !== null ? (
        <>
          <div className="acc-days" role="group" aria-label="요일 선택">
            {WEEKDAY_LABELS.map((label, d) => {
              const has = result.cells.some((c) => c.weekday === d && c.scored);
              return (
                <button
                  type="button"
                  key={d}
                  className={`acc-day${d === weekday ? ' is-on' : ''}${has ? '' : ' is-gray'}`}
                  aria-pressed={d === weekday}
                  disabled={!has}
                  onClick={() => setPicked(d)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <MiniChart cells={result.cells.filter((c) => c.weekday === weekday)} weekday={weekday} />
        </>
      ) : (
        <p className="muted small acc-empty">
          30분마다 쌓이는 실측이 운영시간(06~21시) 칸마다 서로 다른 수집 {MIN_CELL_SAMPLES}회 이상 모이면 예측과 비교한
          정확도가 이 자리에 표시됩니다.
        </p>
      )}

      {result && result.golden.length > 0 && (
        <p className="small acc-golden">
          골든타임 적중 {result.golden.filter((g) => g.hit).length}/{result.golden.length}요일
          <span className="muted"> (예측 골든타임이 실측 하위 {GOLDEN_TOP_K}위 이내)</span>
        </p>
      )}

      <p className="muted small">
        {result ? summaryLine(result, year) : `${year}년 패턴 예측 검증 중 — 실측 이력을 불러오는 중입니다.`} 회색은 표본
        부족(칸당 30분 수집 {MIN_CELL_SAMPLES}회 미만)으로 채점에서 뺀 구간입니다.
      </p>
    </section>
  );
}

const W = 340;
const H = 120;
const PAD_X = 10;
const PAD_TOP = 8;
const PAD_BOTTOM = 18;

function MiniChart({ cells, weekday }: { cells: BacktestCell[]; weekday: number }) {
  const hours = OPEN_HOUR_END - OPEN_HOUR_START;
  const values = cells.flatMap((c) => [c.predicted, c.measured]).filter((v): v is number => v !== null);
  const max = Math.max(100, ...values);
  const x = (h: number) => PAD_X + ((h - OPEN_HOUR_START) / (hours - 1)) * (W - PAD_X * 2);
  const y = (v: number) => PAD_TOP + (1 - v / max) * (H - PAD_TOP - PAD_BOTTOM);
  const predicted = cells.filter((c) => c.predicted !== null);
  const line = predicted.map((c) => `${x(c.hour)},${y(c.predicted as number)}`).join(' ');
  const scored = cells.filter((c) => c.scored);
  const aria = `${WEEKDAY_LABELS[weekday]}요일 예측 대 실측 주차율. 채점 ${scored.length}칸 / ${cells.length}칸.`;

  return (
    <figure className="acc-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
        {cells
          .filter((c) => !c.scored)
          .map((c) => (
            <rect
              key={`g${c.hour}`}
              className="acc-gap"
              x={x(c.hour) - (W - PAD_X * 2) / (hours - 1) / 2}
              y={PAD_TOP}
              width={(W - PAD_X * 2) / (hours - 1)}
              height={H - PAD_TOP - PAD_BOTTOM}
            />
          ))}
        <polyline points={line} className="acc-pred" />
        {cells
          .filter((c) => c.measured !== null)
          .map((c) => (
            <circle
              key={`m${c.hour}`}
              cx={x(c.hour)}
              cy={y(c.measured as number)}
              r="3.5"
              className={c.scored ? 'acc-meas' : 'acc-meas is-gray'}
            >
              <title>
                {`${c.hour}시 — 예측 ${c.predicted === null ? '-' : Math.round(c.predicted)}% · 실측 ${Math.round(c.measured as number)}% (측정 ${c.samples}회·30분 슬롯 ${c.slots}개)`}
              </title>
            </circle>
          ))}
        {[6, 9, 12, 15, 18, 21].map((h) => (
          <text key={h} x={x(h)} y={H - 4} className="acc-axis" textAnchor="middle">
            {h}
          </text>
        ))}
      </svg>
      <figcaption className="acc-legend">
        <span><i className="acc-key-pred" /> 2025년 예측</span>
        <span><i className="acc-key-meas" /> 실측</span>
        <span><i className="acc-key-gap" /> 검증 중(표본 부족)</span>
      </figcaption>
    </figure>
  );
}
