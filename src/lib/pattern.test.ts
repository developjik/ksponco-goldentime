import { describe, expect, it } from 'vitest';
import {
  OPEN_HOUR_END,
  OPEN_HOUR_START,
  WEEKDAY_LABELS,
  cellLevel,
  goldenTime,
  goldenTimeByWeekday,
  isParkingPattern,
  weekdayAvgPercent,
  type ParkingPattern,
} from './pattern';

/** 테스트용 가짜 패턴(실데이터 아님) — 월요일 오전 7시가 가장 한산한 구조. */
function fixture(overrides: Partial<ParkingPattern> = {}): ParkingPattern {
  const weekdayHour = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) =>
      h >= 6 && h < 22 ? { avg: 700 + d * 100 + Math.abs(h - 19) * 60, samples: 40 } : null,
    ),
  );
  // 월요일 07시를 최저로 만든다
  weekdayHour[0][7] = { avg: 500, samples: 40 };
  return {
    source: 'test',
    year: 2025,
    capacity: 2800,
    generatedAt: '2026-11-21T00:00:00.000Z',
    records: 7803,
    weekdayHour,
    ...overrides,
  };
}

describe('isParkingPattern', () => {
  it('7×24 weekdayHour 구조를 검증한다', () => {
    expect(isParkingPattern(fixture())).toBe(true);
    expect(isParkingPattern({ year: 2025 })).toBe(false);
    expect(isParkingPattern(null)).toBe(false);
  });

  it('weekdayHour 행이 7개가 아니면 거절한다', () => {
    const bad = fixture();
    bad.weekdayHour = bad.weekdayHour.slice(0, 6);
    expect(isParkingPattern(bad)).toBe(false);
  });
});

describe('goldenTime', () => {
  it('운영시간(06~21시) 중 평균이 가장 낮은 시간대를 고른다', () => {
    const g = goldenTime(fixture(), 0);
    expect(g).not.toBeNull();
    expect(g!.hour).toBe(7);
    expect(g!.weekday).toBe(0);
    expect(g!.percent).toBe(18); // 500/2800
  });

  it('전체(월~일) 요일을 묶으면 최저 칸을 고른다', () => {
    const g = goldenTime(fixture(), 'all');
    expect(g!.weekday).toBe(0);
    expect(g!.hour).toBe(7);
  });

  it('운영시간 밖(예: 새벽 3시 아주 낮은 값)은 후보에서 제외한다', () => {
    const p = fixture();
    p.weekdayHour[3][3] = { avg: 10, samples: 40 }; // 목요일 새벽 3시
    const g = goldenTime(p, 3);
    expect(g!.hour).not.toBe(3);
    expect(g!.hour).toBeGreaterThanOrEqual(OPEN_HOUR_START);
    expect(g!.hour).toBeLessThan(OPEN_HOUR_END);
  });

  it('데이터가 전혀 없으면 null을 반환한다', () => {
    const empty = fixture({ weekdayHour: Array.from({ length: 7 }, () => Array(24).fill(null)) });
    expect(goldenTime(empty, 0)).toBeNull();
    expect(goldenTime(empty, 'all')).toBeNull();
  });

  it('동률이면 이른 시간을 우선한다', () => {
    const p = fixture();
    p.weekdayHour[1][9] = { avg: 500, samples: 10 };
    p.weekdayHour[1][20] = { avg: 500, samples: 10 };
    const others = p.weekdayHour[1]
      .map((c, h) => (h >= 6 && h < 22 ? { avg: 900, samples: 10 } : c))
      .map((c, h) => (h === 9 || h === 20 ? p.weekdayHour[1][h] : c));
    p.weekdayHour[1] = others;
    const g = goldenTime(p, 1);
    expect(g!.hour).toBe(9);
  });
});

describe('goldenTimeByWeekday', () => {
  it('요일별 골든타임을 월부터 일 순서로 반환한다', () => {
    const list = goldenTimeByWeekday(fixture());
    expect(list).toHaveLength(7);
    expect(list.map((g) => WEEKDAY_LABELS[g.weekday])).toEqual([
      '월',
      '화',
      '수',
      '목',
      '금',
      '토',
      '일',
    ]);
  });

  it('데이터 없는 요일은 건너뛴다', () => {
    const p = fixture();
    p.weekdayHour[5] = Array(24).fill(null);
    const list = goldenTimeByWeekday(p);
    expect(list).toHaveLength(6);
    expect(list.some((g) => g.weekday === 5)).toBe(false);
  });
});

describe('cellLevel / weekdayAvgPercent', () => {
  it('칸 단계는 재차율 혼잡 단계와 같은 척도를 쓴다', () => {
    expect(cellLevel({ avg: 700, samples: 5 })).toBe('여유'); // 25%
    expect(cellLevel({ avg: 1400, samples: 5 })).toBe('보통'); // 50%
    expect(cellLevel({ avg: 2100, samples: 5 })).toBe('혼잡'); // 75%
    expect(cellLevel({ avg: 2500, samples: 5 })).toBe('매우 혼잡'); // 89%
  });

  it('요일별 평균 재차율은 운영시간 칸만 평균한다', () => {
    const p = fixture();
    p.weekdayHour[2] = Array.from({ length: 24 }, (_, h) =>
      h === 10 ? { avg: 2800, samples: 10 } : null,
    );
    const avg = weekdayAvgPercent(p, 2);
    expect(avg).toBe(100);
  });

  it('데이터 없는 요일은 null', () => {
    const p = fixture();
    p.weekdayHour[4] = Array(24).fill(null);
    expect(weekdayAvgPercent(p, 4)).toBeNull();
  });
});
