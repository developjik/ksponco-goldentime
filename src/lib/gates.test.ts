import { describe, expect, it } from 'vitest';
import {
  WEEKDAY_LABELS,
  dwellMinutes,
  formatDwell,
  isGatesData,
  normalizeGateName,
  summarizeGates,
  type GatesData,
} from './gates';

describe('normalizeGateName', () => {
  it('차로 번호·CMB 변형을 정규 게이트명으로 묶는다', () => {
    expect(normalizeGateName('입구:동2문입구#1')).toBe('동2문');
    expect(normalizeGateName('입구:동2문입구#2')).toBe('동2문');
    expect(normalizeGateName('입구:남2문CMB')).toBe('남2문');
    expect(normalizeGateName('입구:북2문입구#3')).toBe('북2문');
  });

  it('입구: 접두가 빠진 값(DESCRIPTION 파싱 결과)도 받는다', () => {
    expect(normalizeGateName('동2문입구#1')).toBe('동2문');
    expect(normalizeGateName('남2문CMB')).toBe('남2문');
  });

  it('게이트가 아니면 null', () => {
    expect(normalizeGateName('출구:동2문출구#1')).toBeNull();
    expect(normalizeGateName('')).toBeNull();
    expect(normalizeGateName('입구:기타')).toBeNull();
  });
});

describe('dwellMinutes', () => {
  it('입차~출차 분 단위 체류시간을 계산한다', () => {
    expect(dwellMinutes('2025-08-24 13:48:38', '2025-08-24 17:21:57')).toBe(213);
    expect(dwellMinutes('2025-08-24 09:00:00', '2025-08-24 09:48:00')).toBe(48);
    expect(dwellMinutes('2025-08-24 23:30:00', '2025-08-25 01:30:00')).toBe(120);
  });

  it('형식 오류는 null', () => {
    expect(dwellMinutes('bad', '2025-08-24 17:21:57')).toBeNull();
    expect(dwellMinutes('', '')).toBeNull();
  });

  it('음수(오염)·3일 초과(방치)는 null로 제외한다', () => {
    expect(dwellMinutes('2025-08-24 18:00:00', '2025-08-24 17:00:00')).toBeNull();
    expect(dwellMinutes('2025-08-01 10:00:00', '2025-08-24 17:00:00')).toBeNull();
  });
});

describe('summarizeGates', () => {
  const gate = (name: string, entries: number, cell: { e: number; d?: number }): GatesData['gates'][number] => ({
    name,
    entries,
    weekdayHour: Array.from({ length: 7 }, (_, d) =>
      Array.from({ length: 24 }, (_, h) => (d === 5 && h === 10 ? cell : null)),
    ),
  });

  const data: GatesData = {
    source: 'test',
    year: 2025,
    records: 100,
    totalCount: 100,
    generatedAt: '2026-11-21T00:00:00.000Z',
    gates: [
      gate('동2문', 8000, { e: 120, d: 200 }), // 60%·토 10시 피크
      gate('북2문', 2000, { e: 40, d: 100 }), // 40%
    ],
  };

  it('비중·피크(요일/시간)·건수 가중 평균 체류를 뽑는다', () => {
    const s = summarizeGates(data);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ name: '동2문', sharePercent: 80 });
    expect(s[0].peak).toMatchObject({ weekday: 5, hour: 10, entries: 120 });
    expect(s[0].avgDwellMin).toBe(200);
    expect(s[1].sharePercent).toBe(20);
  });

  it('체류 표본이 없으면 avgDwellMin null', () => {
    const noDwell: GatesData = { ...data, gates: [gate('남2문', 100, { e: 10 })] };
    expect(summarizeGates(noDwell)[0].avgDwellMin).toBeNull();
  });

  it('피크 요일 라벨은 월~일 체계와 일치한다', () => {
    const s = summarizeGates(data);
    expect(WEEKDAY_LABELS[s[0].peak.weekday]).toBe('토');
  });
});

describe('isGatesData', () => {
  it('구조를 검증한다', () => {
    const ok = {
      source: 's',
      year: 2025,
      records: 1,
      totalCount: 1,
      generatedAt: 'x',
      gates: [{ name: '동2문', entries: 1, weekdayHour: [[{ e: 1 }]] }],
    };
    expect(isGatesData(ok)).toBe(true);
    expect(isGatesData({ gates: [] })).toBe(false);
    expect(isGatesData(null)).toBe(false);
  });
});

describe('formatDwell', () => {
  it('시·분 표기로 바꾼다', () => {
    expect(formatDwell(48)).toBe('48분');
    expect(formatDwell(60)).toBe('1시간');
    expect(formatDwell(154)).toBe('2시간 34분');
  });
});
