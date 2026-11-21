/**
 * 2025년 요일×시간 주차 패턴(집산물) 로딩·골든타임 도출 순수 로직.
 * 스크립트 scripts/aggregate-2025.mjs가 만든 public/data/pattern-2025.json 대응.
 */
import { TOTAL_CAPACITY, congestionLevel, occupancyPercent } from './congestion';

export interface HourCell {
  avg: number;
  samples: number;
}

export interface ParkingPattern {
  source: string;
  year: number;
  capacity: number;
  generatedAt: string;
  records: number;
  /** [요일(월=0..일=6)][시간(0..23)] — 데이터 없는 칸은 null */
  weekdayHour: (HourCell | null)[][];
}

export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

/** 입차 가능 운영시간(올림픽공원 주차장 기준) — 골든타임 후보는 이 안에서만 고른다. */
export const OPEN_HOUR_START = 6;
export const OPEN_HOUR_END = 22; // exclusive

export function isParkingPattern(data: unknown): data is ParkingPattern {
  if (typeof data !== 'object' || data === null) return false;
  const p = data as Partial<ParkingPattern>;
  return (
    typeof p.year === 'number' &&
    typeof p.capacity === 'number' &&
    Array.isArray(p.weekdayHour) &&
    p.weekdayHour.length === 7
  );
}

export interface GoldenTime {
  weekday: number;
  hour: number;
  /** 그 시간의 평균 재차율(%) */
  percent: number;
  avg: number;
}

/**
 * 요일(또는 전체)의 골든타임: 운영시간(06~21시) 중 평균 주차대수가 가장 낮은 시간대.
 * samples가 있는 칸만 대상. 동률이면 이른 시간을 우선한다.
 */
export function goldenTime(
  pattern: ParkingPattern,
  weekday: number | 'all',
  capacity: number = TOTAL_CAPACITY,
): GoldenTime | null {
  const days = weekday === 'all' ? [0, 1, 2, 3, 4, 5, 6] : [weekday];
  let best: GoldenTime | null = null;
  for (const d of days) {
    const hours = pattern.weekdayHour[d];
    if (!Array.isArray(hours)) continue;
    for (let h = OPEN_HOUR_START; h < OPEN_HOUR_END; h += 1) {
      const cell = hours[h];
      if (!cell || cell.samples <= 0) continue;
      const percent = occupancyPercent(cell.avg, capacity || pattern.capacity);
      if (!best || percent < best.percent) {
        best = { weekday: d, hour: h, percent, avg: cell.avg };
      }
    }
  }
  return best;
}

/** 요일별 골든타임 7개(월~일 순). 데이터 없는 요일은 건너뛴다. */
export function goldenTimeByWeekday(
  pattern: ParkingPattern,
  capacity: number = TOTAL_CAPACITY,
): GoldenTime[] {
  const out: GoldenTime[] = [];
  for (let d = 0; d < 7; d += 1) {
    const g = goldenTime(pattern, d, capacity);
    if (g) out.push(g);
  }
  return out;
}

/** 히트맵 칸 색 단계 — 재차율 기준 혼잡 단계와 같은 척도를 쓴다. */
export function cellLevel(cell: HourCell, capacity: number = TOTAL_CAPACITY) {
  return congestionLevel(occupancyPercent(cell.avg, capacity));
}

/** 히트맵 하단 요약용: 요일별 평균 재차율(운영시간만). */
export function weekdayAvgPercent(
  pattern: ParkingPattern,
  weekday: number,
  capacity: number = TOTAL_CAPACITY,
): number | null {
  const hours = pattern.weekdayHour[weekday] ?? [];
  let s = 0;
  let n = 0;
  for (let h = OPEN_HOUR_START; h < OPEN_HOUR_END; h += 1) {
    const cell = hours[h];
    if (!cell || cell.samples <= 0) continue;
    s += occupancyPercent(cell.avg, capacity);
    n += 1;
  }
  return n > 0 ? Math.round(s / n) : null;
}
