/**
 * 예측 백테스트 순수 로직 — 2025년 요일×시간 패턴(예측)을 실측 이력(realtime-history.json)과 비교한다.
 * 실측은 KST 요일×시간 칸으로 묶어 평균 주차율을 내고, 운영시간(06~21시) 칸만 채점한다.
 * 지표: 주차율 MAE(%p)·Spearman 순위상관(ρ)·요일별 골든타임 적중.
 */
import type { HistoryPoint } from './history';
import { OPEN_HOUR_END, OPEN_HOUR_START, type ParkingPattern } from './pattern';

/** 한국 표준시(UTC+9, 서머타임 없음) — 브라우저 시간대와 무관하게 칸을 나눈다. */
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 30분 수집 슬롯 길이 — 같은 슬롯 안 연속 측정(수동 재실행 등)은 한 번으로 센다. */
export const SLOT_MS = 30 * 60 * 1000;

/** 칸 하나가 채점에 들어가는 최소 30분 슬롯 수(한 시간치). */
export const MIN_CELL_SAMPLES = 2;

/** 정확도 숫자를 보여주는 최소 채점 칸 수(운영시간 하루치 16칸의 절반 이상). */
export const MIN_SCORED_CELLS = 8;

/** 골든타임 적중 판정: 예측 골든타임이 실측 하위 몇 위 안에 들면 적중으로 본다. */
export const GOLDEN_TOP_K = 3;

export interface MeasuredCell {
  /** 칸 안 실측 평균 주차대수 */
  avg: number;
  /** 칸 안 실측 수 */
  samples: number;
  /** 칸 안 서로 다른 30분 슬롯 수 */
  slots: number;
}

export interface KstSlot {
  /** 월=0 … 일=6 */
  weekday: number;
  hour: number;
  /** YYYY-MM-DD(KST) */
  date: string;
}

/** epoch(ms) → KST 요일(월=0)·시·날짜. */
export function kstSlot(t: number): KstSlot {
  const d = new Date(t + KST_OFFSET_MS);
  return {
    weekday: (d.getUTCDay() + 6) % 7,
    hour: d.getUTCHours(),
    date: d.toISOString().slice(0, 10),
  };
}

/** 실측 이력 → [요일][시간] 칸 평균. 측정이 없는 칸은 null. */
export function measuredWeekdayHour(points: HistoryPoint[]): (MeasuredCell | null)[][] {
  const sum = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ s: 0, n: 0, slots: new Set<number>() })),
  );
  for (const p of points) {
    if (!Number.isFinite(p.t) || !Number.isFinite(p.count) || p.count < 0) continue;
    const { weekday, hour } = kstSlot(p.t);
    const cell = sum[weekday][hour];
    cell.s += p.count;
    cell.n += 1;
    cell.slots.add(Math.floor(p.t / SLOT_MS));
  }
  return sum.map((hours) =>
    hours.map(({ s, n, slots }) => (n > 0 ? { avg: s / n, samples: n, slots: slots.size } : null)),
  );
}

export interface BacktestCell {
  weekday: number;
  hour: number;
  /** 예측 주차율(%) — 패턴 칸이 없으면 null */
  predicted: number | null;
  /** 실측 주차율(%) — 측정이 없으면 null */
  measured: number | null;
  samples: number;
  /** 실측이 걸친 서로 다른 30분 슬롯 수 */
  slots: number;
  /** 예측·실측이 모두 있고 슬롯이 충분해 채점에 들어간 칸 */
  scored: boolean;
}

export interface GoldenCheck {
  weekday: number;
  predictedHour: number;
  measuredHour: number;
  /** 실측 기준 예측 골든타임의 순위(1 = 가장 한산) */
  rank: number;
  hit: boolean;
}

export type BacktestStatus = 'verifying' | 'partial' | 'ready';

export interface BacktestResult {
  /** verifying = 표본 부족(숫자 미표시), partial = 일부 요일만 확보, ready = 7요일 모두 확보 */
  status: BacktestStatus;
  /** 주차율 평균절대오차(%p, 소수 1자리) — verifying이면 null */
  mae: number | null;
  /** 평균 부호오차(실측 − 예측, %p, 소수 1자리) — 양수면 실측이 예측보다 붐볐다 */
  bias: number | null;
  /** Spearman 순위상관 ρ(소수 2자리) — 계산 불가 시 null */
  spearman: number | null;
  /** 채점에 쓴 실측 수 */
  n: number;
  /** 채점 칸 수 */
  scoredCells: number;
  /** 채점 칸이 있는 요일 수(0~7) */
  weekdaysCovered: number;
  /** 채점에 쓴 실측의 서로 다른 날짜 수 */
  days: number;
  /** 채점에 쓴 실측 구간(epoch ms) */
  from: number | null;
  to: number | null;
  /** 운영시간 칸 전체(요일×시간, 06~21시) */
  cells: BacktestCell[];
  /** 운영시간 칸이 모두 채점된 요일의 골든타임 적중 */
  golden: GoldenCheck[];
}

const round = (v: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

const pct = (count: number, capacity: number) => (count / capacity) * 100;

/** 동률은 평균 순위(1부터). */
export function ranks(values: number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array<number>(values.length);
  let k = 0;
  while (k < order.length) {
    let j = k;
    while (j + 1 < order.length && order[j + 1].v === order[k].v) j += 1;
    const r = (k + j) / 2 + 1;
    for (let m = k; m <= j; m += 1) out[order[m].i] = r;
    k = j + 1;
  }
  return out;
}

/** Spearman 순위상관(동률 평균 순위 + 피어슨). 3쌍 미만이거나 분산 0이면 null. */
export function spearman(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const rx = ranks(xs);
  const ry = ranks(ys);
  const n = rx.length;
  const mx = rx.reduce((s, v) => s + v, 0) / n;
  const my = ry.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (rx[i] - mx) * (ry[i] - my);
    sxx += (rx[i] - mx) ** 2;
    syy += (ry[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** 패턴 예측 vs 실측 백테스트. */
export function backtest(pattern: ParkingPattern, points: HistoryPoint[]): BacktestResult {
  const capacity = pattern.capacity > 0 ? pattern.capacity : 2800;
  const measured = measuredWeekdayHour(points);
  const cells: BacktestCell[] = [];
  for (let d = 0; d < 7; d += 1) {
    for (let h = OPEN_HOUR_START; h < OPEN_HOUR_END; h += 1) {
      const p = pattern.weekdayHour[d]?.[h];
      const m = measured[d][h];
      const predicted = p && p.samples > 0 ? pct(p.avg, capacity) : null;
      const samples = m?.samples ?? 0;
      const slots = m?.slots ?? 0;
      cells.push({
        weekday: d,
        hour: h,
        predicted,
        measured: m ? pct(m.avg, capacity) : null,
        samples,
        slots,
        scored: predicted !== null && m !== null && slots >= MIN_CELL_SAMPLES,
      });
    }
  }

  const scored = cells.filter((c) => c.scored);
  const scoredKeys = new Set(scored.map((c) => c.weekday * 24 + c.hour));
  const used = points.filter((p) => {
    const s = kstSlot(p.t);
    return scoredKeys.has(s.weekday * 24 + s.hour);
  });
  const days = new Set(used.map((p) => kstSlot(p.t).date)).size;
  const n = used.length;
  const weekdaysCovered = new Set(scored.map((c) => c.weekday)).size;

  const enough = scored.length >= MIN_SCORED_CELLS;
  const pred = scored.map((c) => c.predicted as number);
  const meas = scored.map((c) => c.measured as number);
  const mae = enough
    ? round(scored.reduce((s, c) => s + Math.abs((c.predicted as number) - (c.measured as number)), 0) / scored.length, 1)
    : null;
  const bias = enough
    ? round(scored.reduce((s, c) => s + ((c.measured as number) - (c.predicted as number)), 0) / scored.length, 1)
    : null;
  const rho = enough ? spearman(pred, meas) : null;

  return {
    status: !enough ? 'verifying' : weekdaysCovered < 7 ? 'partial' : 'ready',
    mae,
    bias,
    spearman: rho === null ? null : round(rho, 2),
    n,
    scoredCells: scored.length,
    weekdaysCovered,
    days,
    from: used.length ? Math.min(...used.map((p) => p.t)) : null,
    to: used.length ? Math.max(...used.map((p) => p.t)) : null,
    cells,
    golden: goldenChecks(cells),
  };
}

/** 운영시간 칸이 모두 채점된 요일만 골든타임 적중을 판정한다. */
function goldenChecks(cells: BacktestCell[]): GoldenCheck[] {
  const out: GoldenCheck[] = [];
  for (let d = 0; d < 7; d += 1) {
    const day = cells.filter((c) => c.weekday === d);
    if (day.length === 0 || !day.every((c) => c.scored)) continue;
    const lowest = (key: 'predicted' | 'measured') =>
      day.reduce((best, c) => ((c[key] as number) < (best[key] as number) ? c : best));
    const predictedHour = lowest('predicted').hour;
    const measuredHour = lowest('measured').hour;
    const at = day.find((c) => c.hour === predictedHour)!.measured as number;
    const rank = 1 + day.filter((c) => (c.measured as number) < at).length;
    out.push({ weekday: d, predictedHour, measuredHour, rank, hit: rank <= GOLDEN_TOP_K });
  }
  return out;
}

/** 기본 선택 요일: 채점 칸이 가장 많은 요일(동률이면 늦은 요일). 없으면 null. */
export function defaultWeekday(result: BacktestResult): number | null {
  let best: number | null = null;
  let bestN = 0;
  for (let d = 0; d < 7; d += 1) {
    const n = result.cells.filter((c) => c.weekday === d && c.scored).length;
    if (n > 0 && n >= bestN) {
      best = d;
      bestN = n;
    }
  }
  return best;
}

/** epoch(ms) → "M/D"(KST). */
function kstDay(t: number): string {
  const d = new Date(t + KST_OFFSET_MS);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function formatSigned(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}

/** 제출 문서용 한 줄 요약. */
export function summaryLine(result: BacktestResult, year = 2025): string {
  if (result.status === 'verifying' || result.mae === null) {
    return `${year}년 패턴 예측 검증 중 — 실측 표본 부족(n=${result.n}, 채점 ${result.scoredCells}칸 / 최소 ${MIN_SCORED_CELLS}칸).`;
  }
  const range = result.from !== null && result.to !== null ? `${kstDay(result.from)}~${kstDay(result.to)} ` : '';
  const parts = [`주차율 MAE ${result.mae.toFixed(1)}%p`];
  if (result.bias !== null) parts.push(`편향 ${formatSigned(result.bias)}%p`);
  if (result.spearman !== null) parts.push(`순위상관 ρ=${result.spearman.toFixed(2)}`);
  if (result.golden.length > 0) {
    const hits = result.golden.filter((g) => g.hit).length;
    parts.push(`골든타임 적중 ${hits}/${result.golden.length}요일(실측 하위 ${GOLDEN_TOP_K}위 이내)`);
  }
  const coverage =
    result.status === 'partial' ? ` · ${result.weekdaysCovered}/7요일 확보, 검증 계속` : '';
  return `${year}년 요일×시간 패턴 예측을 ${range}실측(30분 수집 n=${result.n}, ${result.scoredCells}칸)과 비교: ${parts.join(' · ')}${coverage}.`;
}
