import {mergeSessionHistory} from './recent';
import { describe, expect, it } from 'vitest';
import type { HistoryPoint } from './history';
import { downsample, mergeLivePoint, parseRecentHistory, windowRecent } from './recent';

const p = (t: number, count: number): HistoryPoint => ({ t, count });

describe('parseRecentHistory — 원문 검증·정규화', () => {
  it('유효한 항목만 남기고 정수로 내린다', () => {
    const raw = [
      { t: 2000.7, count: 100.9 },
      { t: 'x', count: 1 },
      { t: 1000, count: -5 },
      null,
      42,
      { t: 1000.2, count: '50' },
    ];
    expect(parseRecentHistory(raw)).toEqual([p(1000, 50), p(2000, 100)]);
  });

  it('시각 오름차순으로 정렬한다', () => {
    const out = parseRecentHistory([{ t: 30, count: 3 }, { t: 10, count: 1 }, { t: 20, count: 2 }]);
    expect(out.map((x) => x.t)).toEqual([10, 20, 30]);
  });

  it('같은 시각이면 마지막 값을 남긴다', () => {
    const out = parseRecentHistory([{ t: 10, count: 1 }, { t: 10, count: 9 }, { t: 20, count: 2 }]);
    expect(out).toEqual([p(10, 9), p(20, 2)]);
  });

  it('배열이 아니면 예외를 던진다', () => {
    expect(() => parseRecentHistory({})).toThrow();
    expect(() => parseRecentHistory('[]')).toThrow();
  });
});

describe('windowRecent — 최근 24시간 창', () => {
  const now = 1_000_000_000_000;

  it('창 안쪽 측정만 남긴다(경계 포함)', () => {
    const day = 24 * 60 * 60 * 1000;
    const pts = [p(now - day, 1), p(now - day + 1, 2), p(now - 1, 3), p(now, 4)];
    expect(windowRecent(pts, now)).toEqual([p(now - day, 1), p(now - day + 1, 2), p(now - 1, 3), p(now, 4)]);
  });

  it('창 밖(24시간 초과)은 버린다', () => {
    const day = 24 * 60 * 60 * 1000;
    const pts = [p(now - day - 1, 0), p(now - 100, 5)];
    expect(windowRecent(pts, now)).toEqual([p(now - 100, 5)]);
  });

  it('살짝 앞선 미래 측정(시각 어긋남)은 허용한다', () => {
    const pts = [p(now + 60_000, 7), p(now + 10 * 60_000, 8)];
    expect(windowRecent(pts, now)).toEqual([p(now + 60_000, 7)]);
  });
});

describe('downsample — 균등 추출', () => {
  it('cap 이하면 그대로 반환한다', () => {
    const pts = [p(1, 1), p(2, 2), p(3, 3)];
    expect(downsample(pts, 5)).toBe(pts);
  });

  it('초과하면 cap개를 양끝 포함해 뽑는다', () => {
    const pts = Array.from({ length: 10 }, (_, i) => p(i, i));
    const out = downsample(pts, 4);
    expect(out).toHaveLength(4);
    expect(out[0]).toEqual(pts[0]);
    expect(out[out.length - 1]).toEqual(pts[9]);
    expect(out.map((x) => x.t)).toEqual([0, 3, 6, 9]);
  });
});

describe('mergeLivePoint — 실시간 값 병합', () => {
  it('이력 마지막보다 새로우면 붙인다', () => {
    expect(mergeLivePoint([p(10, 1), p(20, 2)], p(30, 3))).toEqual([p(10, 1), p(20, 2), p(30, 3)]);
  });

  it('같거나 오래 된 값은 무시한다', () => {
    expect(mergeLivePoint([p(10, 1), p(20, 5)], p(20, 9))).toEqual([p(10, 1), p(20, 5)]);
    expect(mergeLivePoint([p(10, 1)], p(5, 9))).toEqual([p(10, 1)]);
  });

  it('이력이 비었으면 실시간 값만 담는다', () => {
    expect(mergeLivePoint([], p(10, 1))).toEqual([p(10, 1)]);
  });

  it('live가 없으면 원본 그대로', () => {
    const pts = [p(10, 1)];
    expect(mergeLivePoint(pts, null)).toBe(pts);
  });
});

describe('세션과 서버 이력 병합',()=>{
  it('누락된 세션점을 보존하며 같은 시각을 중복하지 않는다',()=>{
    expect(mergeSessionHistory([{t:1,count:10},{t:3,count:30}],[{t:2,count:20},{t:3,count:31}])).toEqual([{t:1,count:10},{t:2,count:20},{t:3,count:31}]);
  });
});
