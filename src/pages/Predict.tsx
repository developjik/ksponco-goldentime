import { useMemo } from 'react';
import AccuracyCard from '../components/AccuracyCard';
import Heatmap from '../components/Heatmap';
import { useGates } from '../hooks/useGates';
import { usePattern } from '../hooks/usePattern';
import { useRecentHistory, type RecentState } from '../hooks/useRecent';
import { backtest } from '../lib/backtest';
import { formatCount } from '../lib/congestion';
import { WEEKDAY_LABELS as DAY, formatDwell, summarizeGates } from '../lib/gates';
import type { GatesData } from '../lib/gates';
import {
  WEEKDAY_LABELS,
  goldenTime,
  goldenTimeByWeekday,
  type ParkingPattern,
} from '../lib/pattern';

export default function Predict() {
  const patternState = usePattern();
  const gatesState = useGates();
  const historyState = useRecentHistory();

  return (
    <div className="home">
      <h1 className="page-title">골든타임 예측·히트맵</h1>

      {patternState.status === 'loading' && <p className="muted">패턴 데이터를 불러오는 중…</p>}

      {patternState.status === 'error' && (
        <p role="alert" className="notice">
          패턴 데이터를 불러오지 못했습니다 ({patternState.message}). 잠시 후 다시 시도해
          주세요.
        </p>
      )}

      {gatesState.status === 'ready' && <GatePanel data={gatesState.data} />}

      {patternState.status === 'absent' && <Preparing />}

      {patternState.status === 'ready' && <Ready data={patternState.pattern} history={historyState} />}
    </div>
  );
}

function Preparing() {
  return (
    <>
      <p className="lede">
        언제 가장 빈자리가 많을지, 과거 기록으로 미리 알려주는 화면을 만들고 있습니다.
      </p>
      <section className="panel" aria-labelledby="data-title">
        <div className="panel-head">
          <h2 id="data-title">학습 데이터 현황</h2>
        </div>
        <ul className="data-list">
          <li className="data-row">
            <span className="data-name">2025년 입출차 기록</span>
            <span className="data-value">약 240만 건</span>
            <span className="data-state is-done">확보 완료</span>
          </li>
          <li className="data-row">
            <span className="data-name">시간별 연계 데이터</span>
            <span className="data-value">7,803건</span>
            <span className="data-state is-done">확보 완료</span>
          </li>
          <li className="data-row">
            <span className="data-name">실시간 주차현황</span>
            <span className="data-value">30분 간격 수집</span>
            <span className="data-state is-live">서비스 중</span>
          </li>
        </ul>
        <p className="muted small">
          확보한 기록을 요일·시간별 빈자리로 집산하는 중입니다. 집계가 끝나면 이 자리에 실제
          히트맵이 표시되고, 각 요일의 골든타임이 함께 안내됩니다.
        </p>
      </section>
      <section className="panel" aria-label="히트맵 미리보기 자리">
        <div className="heatmap-skeleton" aria-hidden="true">
          {Array.from({ length: 7 }, (_, d) => (
            <div className="heatmap-row" key={d}>
              {Array.from({ length: 24 }, (_, h) => (
                <span
                  className="heatmap-cell"
                  key={h}
                  style={{ opacity: 0.18 + ((d * 24 + h) % 7) * 0.05 }}
                />
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Ready({ data, history }: { data: ParkingPattern; history: RecentState }) {
  const byWeekday = goldenTimeByWeekday(data, data.capacity);
  const overall = goldenTime(data, 'all', data.capacity);
  const result = useMemo(
    () => (history.status === 'ready' ? backtest(data, history.data) : null),
    [data, history],
  );

  return (
    <>
      <p className="lede">
        {data.year}년 실측 {formatCount(data.records)}건에서 뽑은 요일×시간별 평균입니다. 붉은칸을
        피해 가장 여유로운 시간대로 가세요.
      </p>

      <section className="panel" aria-labelledby="best-title">
        <div className="panel-head">
          <h2 id="best-title">이번 주 골든타임</h2>
        </div>
        {overall && (
          <p className="best-overall">
            가장 한산한 시간은{' '}
            <strong>
              {WEEKDAY_LABELS[overall.weekday]}요일 {overall.hour}시
            </strong>{' '}
            — 평균 {formatCount(overall.avg)}대 (주차율 {overall.percent}%)
          </p>
        )}
        <ul className="golden-list">
          {byWeekday.map((g) => (
            <li key={g.weekday}>
              <span className="golden-day">{WEEKDAY_LABELS[g.weekday]}요일</span>
              <span className="golden-hour">{g.hour}:00</span>
              <span className="golden-avg">
                평균 {formatCount(g.avg)}대 · {g.percent}%
              </span>
            </li>
          ))}
        </ul>
      </section>

      {history.status === 'ready' && (history.stale || history.refreshError) && <p role="status" className="notice">
        실측 이력 {history.refreshError ? `갱신 실패 (${history.refreshError})` : '오래됨'}.
        마지막 수집: {history.data.length ? new Date(history.data[history.data.length-1].t).toLocaleString('ko-KR') : '기록 없음'}.
        마지막 성공 이력 기준 정확도입니다.
      </p>}
      <AccuracyCard result={result} year={data.year} historyLoading={history.status === 'loading'} />

      <section className="panel" aria-labelledby="map-title">
        <div className="panel-head">
          <h2 id="map-title">요일×시간 히트맵</h2>
        </div>
        <Heatmap pattern={data} />
        <p className="muted small">
          출처: {data.source}. 운영시간(06~22시) 외 칸은 비어 있습니다. 골든타임은 운영시간 중
          평균 주차율이 가장 낮은 시간대를 말합니다.
        </p>
      </section>
    </>
  );
}

function GatePanel({ data }: { data: GatesData }) {
  const rows = summarizeGates(data);
  return (
    <section className="panel" aria-labelledby="gate-title">
      <div className="panel-head">
        <h2 id="gate-title">어느 문으로 들어올까?</h2>
      </div>
      <p className="muted small">
        {data.year}년 실제 입차 {formatCount(data.records)}건에서 뽑은 게이트별 유입 양상입니다.
      </p>
      <ul className="data-list">
        {rows.map((g) => (
          <li className="gate-row" key={g.name}>
            <span className="gate-name">{g.name}</span>
            <span className="gate-figures">
              입차 비중 {g.sharePercent}% · 피크 {DAY[g.peak.weekday]}요일 {g.peak.hour}시
              {g.avgDwellMin !== null && <> · 평균 체류 {formatDwell(g.avgDwellMin)}</>}
            </span>
            <span className="gate-share-bar" aria-hidden="true">
              <i style={{ width: `${g.sharePercent}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        출처: {data.source}. 차로 번호·버스 전용(CMB) 입구는 같은 문으로 합쳤습니다.
      </p>
    </section>
  );
}
