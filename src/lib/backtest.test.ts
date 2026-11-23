import { describe, expect, it } from 'vitest';
import {
  GOLDEN_TOP_K,
  KST_OFFSET_MS,
  MIN_CELL_SAMPLES,
  MIN_SCORED_CELLS,
  backtest,
  defaultWeekday,
  kstSlot,
  measuredWeekdayHour,
  ranks,
  spearman,
  summaryLine,
} from './backtest';
import type { HistoryPoint } from './history';
import type { ParkingPattern } from './pattern';

/** 2025-03-17(월) 00:00 KST의 epoch(ms). */
const MON_KST = Date.UTC(2025, 2, 17) - KST_OFFSET_MS;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** 테스트용 가짜 패턴(실데이터 아님): 운영시간 주차대수 = 1000 + (h - 6) * 100, 월요일만 06시를 최저. */
function fixture(): ParkingPattern {
  const weekdayHour = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, (_, h) => ({ avg: 1000 + Math.abs(h - 6) * 100, samples: 40 })),
  );
  return {
    source: 'test',
    year: 2025,
    capacity: 2800,
    generatedAt: '2026-11-21T00:00:00.000Z',
    records: 1,
    weekdayHour,
  };
}

/** weekday(월=0)·hour(KST) 칸에 30분 간격 측정 k개. */
function slot(weekday: number, hour: number, count: number, k = 2, week = 0): HistoryPoint[] {
  const base = MON_KST + (week * 7 + weekday) * DAY + hour * HOUR;
  return Array.from({ length: k }, (_, i) => ({ t: base + i * 30 * 60 * 1000, count }));
}

/** 하루 운영시간(06~21시) 전체를 fn(h)대로 측정. */
function fullDay(weekday: number, fn: (h: number) => number, week = 0): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (let h = 6; h < 22; h += 1) out.push(...slot(weekday, h, fn(h), 2, week));
  return out;
}

describe('kstSlot — 브라우저 시간대와 무관한 KST 칸', () => {
  it('UTC 15:00 = 다음 날 KST 00시', () => {
    // 2025-03-16(일) 15:00 UTC = 2025-03-17(월) 00:00 KST
    expect(kstSlot(Date.UTC(2025, 2, 16, 15))).toEqual({ weekday: 0, hour: 0, date: '2025-03-17' });
  });
  it('일요일은 6', () => {
    expect(kstSlot(MON_KST + 6 * DAY + 13 * HOUR)).toMatchObject({ weekday: 6, hour: 13 });
  });
});

describe('measuredWeekdayHour', () => {
  it('칸별 평균·표본 수를 낸다', () => {
    const grid = measuredWeekdayHour([...slot(2, 9, 1000, 1), ...slot(2, 9, 2000, 1, 1)]);
    expect(grid[2][9]).toEqual({ avg: 1500, samples: 2 });
    expect(grid[2][10]).toBeNull();
  });
  it('잘못된 값은 건너뛴다', () => {
    const grid = measuredWeekdayHour([{ t: NaN, count: 1 }, { t: MON_KST, count: -1 }]);
    expect(grid.flat().every((c) => c === null)).toBe(true);
  });
});

describe('ranks·spearman', () => {
  it('동률은 평균 순위', () => {
    expect(ranks([10, 20, 20, 5])).toEqual([2, 3.5, 3.5, 1]);
  });
  it('단조 증가 = 1, 역순 = -1', () => {
    expect(spearman([1, 2, 3, 4], [10, 40, 90, 160])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
  });
  it('3쌍 미만·분산 0이면 null', () => {
    expect(spearman([1, 2], [1, 2])).toBeNull();
    expect(spearman([1, 2, 3], [5, 5, 5])).toBeNull();
  });
});

describe('backtest', () => {
  it('실측이 없으면 verifying, 숫자는 null', () => {
    const r = backtest(fixture(), []);
    expect(r.status).toBe('verifying');
    expect(r.mae).toBeNull();
    expect(r.spearman).toBeNull();
    expect(r.n).toBe(0);
    expect(r.cells).toHaveLength(7 * 16);
    expect(summaryLine(r)).toContain('검증 중');
  });

  it(`표본 ${MIN_CELL_SAMPLES}개 미만 칸은 채점에서 빠진다(회색)`, () => {
    const r = backtest(fixture(), [...slot(0, 9, 1000, 1), ...slot(0, 10, 1000, 2)]);
    const c9 = r.cells.find((c) => c.weekday === 0 && c.hour === 9)!;
    const c10 = r.cells.find((c) => c.weekday === 0 && c.hour === 10)!;
    expect(c9).toMatchObject({ samples: 1, scored: false });
    expect(c10).toMatchObject({ samples: 2, scored: true });
    expect(r.n).toBe(2);
  });

  it('운영시간 밖 측정은 채점하지 않는다', () => {
    const r = backtest(fixture(), slot(0, 3, 500, 4));
    expect(r.scoredCells).toBe(0);
    expect(r.n).toBe(0);
  });

  it(`채점 칸이 ${MIN_SCORED_CELLS}칸 미만이면 verifying`, () => {
    const pts: HistoryPoint[] = [];
    for (let h = 6; h < 6 + MIN_SCORED_CELLS - 1; h += 1) pts.push(...slot(1, h, 1000));
    expect(backtest(fixture(), pts).status).toBe('verifying');
    pts.push(...slot(1, 6 + MIN_SCORED_CELLS - 1, 1000));
    expect(backtest(fixture(), pts).status).toBe('partial');
  });

  it('예측과 실측이 같으면 MAE 0·ρ 1·골든타임 적중', () => {
    const p = fixture();
    const r = backtest(p, fullDay(0, (h) => p.weekdayHour[0][h]!.avg));
    expect(r.status).toBe('partial');
    expect(r.mae).toBe(0);
    expect(r.bias).toBe(0);
    expect(r.spearman).toBe(1);
    expect(r.n).toBe(32);
    expect(r.scoredCells).toBe(16);
    expect(r.weekdaysCovered).toBe(1);
    expect(r.days).toBe(1);
    expect(r.golden).toEqual([{ weekday: 0, predictedHour: 6, measuredHour: 6, rank: 1, hit: true }]);
  });

  it('일정한 오프셋은 MAE·편향으로, 순위는 유지', () => {
    const p = fixture();
    // +280대 = +10%p
    const r = backtest(p, fullDay(0, (h) => p.weekdayHour[0][h]!.avg + 280));
    expect(r.mae).toBe(10);
    expect(r.bias).toBe(10);
    expect(r.spearman).toBe(1);
  });

  it(`실측 골든타임이 예측과 다르면 순위로 판정(하위 ${GOLDEN_TOP_K}위 이내 적중)`, () => {
    // 실측은 21시가 최저, 06시가 최고 → 예측 골든타임(06시)은 16위
    const r = backtest(fixture(), fullDay(0, (h) => 3000 - h * 100));
    expect(r.golden[0]).toMatchObject({ predictedHour: 6, measuredHour: 21, rank: 16, hit: false });
    expect(r.spearman).toBe(-1);
  });

  it('운영시간 칸이 하나라도 비면 그 요일 골든타임은 판정하지 않는다', () => {
    const pts = fullDay(0, () => 1000).filter((p) => kstSlot(p.t).hour !== 15);
    expect(backtest(fixture(), pts).golden).toEqual([]);
  });

  it('7요일 모두 채점 칸이 있으면 ready', () => {
    const pts: HistoryPoint[] = [];
    for (let d = 0; d < 7; d += 1) pts.push(...fullDay(d, () => 1400));
    const r = backtest(fixture(), pts);
    expect(r.status).toBe('ready');
    expect(r.weekdaysCovered).toBe(7);
    expect(r.days).toBe(7);
    expect(r.golden).toHaveLength(7);
  });

  it('패턴 칸이 없으면 그 칸은 채점하지 않는다', () => {
    const p = fixture();
    p.weekdayHour[0][9] = null;
    const r = backtest(p, slot(0, 9, 1000));
    expect(r.cells.find((c) => c.weekday === 0 && c.hour === 9)).toMatchObject({ predicted: null, scored: false });
  });
});

describe('defaultWeekday — 카드 차트 기본 요일', () => {
  it('채점 칸이 가장 많은 요일, 동률이면 늦은 요일', () => {
    const pts = [...slot(1, 9, 1000), ...slot(1, 10, 1000), ...slot(3, 9, 1000), ...slot(5, 9, 1000)];
    expect(defaultWeekday(backtest(fixture(), pts))).toBe(1);
    expect(defaultWeekday(backtest(fixture(), [...slot(3, 9, 1000), ...slot(5, 9, 1000)]))).toBe(5);
  });
  it('채점 칸이 없으면 null', () => {
    expect(defaultWeekday(backtest(fixture(), slot(2, 9, 1000, 1)))).toBeNull();
  });
});

describe('summaryLine', () => {
  it('지표·표본·기간·확보 요일을 한 줄에 담는다', () => {
    const p = fixture();
    const r = backtest(p, fullDay(0, (h) => p.weekdayHour[0][h]!.avg + 280));
    const line = summaryLine(r, 2025);
    expect(line).not.toContain('\n');
    expect(line).toContain('MAE 10.0%p');
    expect(line).toContain('편향 +10.0%p');
    expect(line).toContain('ρ=1.00');
    expect(line).toContain('n=32');
    expect(line).toContain('3/17~3/17');
    expect(line).toContain('골든타임 적중 1/1요일');
    expect(line).toContain('1/7요일 확보');
  });
});
