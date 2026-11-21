import { describe, expect, it } from 'vitest';
import {
  TOTAL_CAPACITY,
  congestionLevel,
  formatCount,
  formatDelta,
  formatClock,
  occupancyPercent,
} from './congestion';

describe('occupancyPercent', () => {
  it('총주차면수 기준 재차율(%)을 반올림해 계산한다', () => {
    expect(occupancyPercent(1400, TOTAL_CAPACITY)).toBe(50);
    expect(occupancyPercent(2008, TOTAL_CAPACITY)).toBe(72);
    expect(occupancyPercent(0)).toBe(0);
  });

  it('100% 초과 분포도 그대로 표시한다(막대 표시에서만 잘라야 함)', () => {
    expect(occupancyPercent(3000, TOTAL_CAPACITY)).toBe(107);
  });

  it('유효하지 않은 입력은 0을 반환한다', () => {
    expect(occupancyPercent(-5)).toBe(0);
    expect(occupancyPercent(Number.NaN)).toBe(0);
    expect(occupancyPercent(100, 0)).toBe(0);
    expect(occupancyPercent(100, -1)).toBe(0);
  });
});

describe('congestionLevel — 경계값은 상위 단계로 편입', () => {
  it('여유: 40% 미만', () => {
    expect(congestionLevel(0)).toBe('여유');
    expect(congestionLevel(39)).toBe('여유');
  });

  it('보통: 40% 이상 70% 미만', () => {
    expect(congestionLevel(40)).toBe('보통');
    expect(congestionLevel(69)).toBe('보통');
  });

  it('혼잡: 70% 이상 85% 미만', () => {
    expect(congestionLevel(70)).toBe('혼잡');
    expect(congestionLevel(84)).toBe('혼잡');
  });

  it('매우 혼잡: 85% 이상(100% 초과 포함)', () => {
    expect(congestionLevel(85)).toBe('매우 혼잡');
    expect(congestionLevel(107)).toBe('매우 혼잡');
  });

  it('유한수가 아니면 여유로 처리해 크래시를 막는다', () => {
    expect(congestionLevel(Number.NaN)).toBe('여유');
  });
});

describe('formatCount — 천 단위 콤마', () => {
  it('로케일과 무관하게 결정적으로 포맷한다', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(2008)).toBe('2,008');
    expect(formatCount(1234567)).toBe('1,234,567');
  });

  it('소수는 반올림한다', () => {
    expect(formatCount(2008.4)).toBe('2,008');
    expect(formatCount(2008.5)).toBe('2,009');
  });
});

describe('formatDelta — 부호 포함 변화량', () => {
  it('양수/음수/0을 구분해 표시한다', () => {
    expect(formatDelta(123)).toBe('+123');
    expect(formatDelta(-45)).toBe('-45');
    expect(formatDelta(0)).toBe('0');
    expect(formatDelta(1234)).toBe('+1,234');
  });
});

describe('formatClock — HH:mm:ss', () => {
  it('현지 시간으로 한 자리를 0으로 채워 표시한다', () => {
    const ts = new Date(2026, 10, 21, 9, 5, 3).getTime();
    expect(formatClock(ts)).toBe('09:05:03');
  });

  it('두 자리 시각은 그대로 표시한다', () => {
    const ts = new Date(2026, 10, 21, 20, 57, 0).getTime();
    expect(formatClock(ts)).toBe('20:57:00');
  });
});
