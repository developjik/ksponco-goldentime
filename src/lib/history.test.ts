import {timeCoords,timePoints,timeSegments} from './history';
import { describe, expect, it } from 'vitest';
import { appendPoint, lastChange, netChange, sparkCoords, type HistoryPoint } from './history';

const p = (t: number, count: number): HistoryPoint => ({ t, count });

describe('appendPoint — 이력 누적', () => {
  it('포인트를 순서대로 추가한다', () => {
    const h = appendPoint([], p(1, 100));
    const h2 = appendPoint(h, p(2, 110));
    expect(h2).toEqual([p(1, 100), p(2, 110)]);
  });

  it('원본 배열을 변경하지 않는다(불변)', () => {
    const h = [p(1, 100)];
    appendPoint(h, p(2, 110));
    expect(h).toEqual([p(1, 100)]);
  });

  it('상한(cap)을 넘기면 오래된 것부터 버린다', () => {
    let h: HistoryPoint[] = [];
    for (let i = 0; i < 5; i += 1) h = appendPoint(h, p(i, 100 + i), 3);
    expect(h).toEqual([p(2, 102), p(3, 103), p(4, 104)]);
  });
});

describe('netChange — 관측 시작 대비 순변화', () => {
  it('마지막 - 첫째를 반환한다', () => {
    expect(netChange([p(1, 100), p(2, 130), p(3, 110)])).toBe(10);
    expect(netChange([p(1, 100), p(2, 80)])).toBe(-20);
  });

  it('포인트가 2개 미만이면 null', () => {
    expect(netChange([])).toBeNull();
    expect(netChange([p(1, 100)])).toBeNull();
  });
});

describe('lastChange — 직전 측정 대비 변화', () => {
  it('증가/감소/변동없음 방향을 계산한다', () => {
    expect(lastChange([p(1, 100), p(2, 120)])).toEqual({ dir: 'up', amount: 20 });
    expect(lastChange([p(1, 100), p(2, 90), p(3, 70)])).toEqual({ dir: 'down', amount: -20 });
    expect(lastChange([p(1, 100), p(2, 100)])).toEqual({ dir: 'flat', amount: 0 });
  });

  it('포인트가 2개 미만이면 null', () => {
    expect(lastChange([p(1, 100)])).toBeNull();
  });
});

describe('sparkCoords — 스파크라인 좌표', () => {
  it('빈 이력이면 빈 배열', () => {
    expect(sparkCoords([], 100, 50)).toEqual([]);
  });

  it('포인트 1개면 캔버스 중앙 점', () => {
    expect(sparkCoords([p(1, 100)], 100, 50)).toEqual([{ x: 50, y: 25 }]);
  });

  it('min==max면 중앙 수평선(나눗셈 0 방지)', () => {
    const coords = sparkCoords([p(1, 100), p(2, 100), p(3, 100)], 100, 50);
    expect(coords.every((c) => c.y === 25)).toBe(true);
    expect(coords.map((c) => c.x)).toEqual([6, 50, 94]);
  });

  it('최솟값은 아래 패딩선, 최댓값은 위 패딩선에 붙는다(y축 반전)', () => {
    const coords = sparkCoords([p(1, 100), p(2, 300), p(3, 200)], 100, 50, 5);
    expect(coords[0].y).toBe(45); // 최솟값 100 → 아래
    expect(coords[1].y).toBe(5); // 최댓값 300 → 위
    expect(coords[2].y).toBe(25); // 중간값 200 → 정중앙
  });

  it('x는 인덱스 균등 간격으로 배치한다', () => {
    const coords = sparkCoords([p(0, 1), p(999, 2), p(5000, 3)], 110, 50, 5);
    expect(coords[0].x).toBeCloseTo(5);
    expect(coords[1].x).toBeCloseTo(55);
    expect(coords[2].x).toBeCloseTo(105);
  });
});

describe('실제 경과시간 좌표와 공백',()=>{
  it('0·30·360분의 중간 점은 그리기 폭의1/12이다',()=>{
    const coords=timeCoords([{t:0,count:1},{t:30*60000,count:2},{t:360*60000,count:3}],340,120);
    expect(coords.map(c=>c.x)).toEqual([6,6+328/12,334]);
  });
  it('동일 시각은 마지막 값으로 정리하고 한 점은 중앙에 둔다',()=>{
    expect(timePoints([{t:2,count:1},{t:1,count:2},{t:2,count:3}])).toEqual([{t:1,count:2},{t:2,count:3}]);
    expect(timeCoords([{t:1,count:2},{t:1,count:3}],340,120)).toEqual([{x:170,y:60}]);
    expect(timeCoords([],340,120)).toEqual([]);
  });
  it('긴 공백을 별도 선으로 분리한다',()=>{
    const points=[{t:0,count:1},{t:30*60000,count:2},{t:360*60000,count:3}];
    expect(timeSegments(points)).toEqual([points.slice(0,2),points.slice(2)]);
    expect(timeSegments([{t:0,count:1},{t:45*60000,count:2}])).toHaveLength(1);
  });
  it('비정상 숫자를 제거하고 작은 캔버스에서도 유한 좌표를 만든다',()=>{
    expect(timePoints([{t:NaN,count:1},{t:1,count:Infinity}])).toEqual([]);
    expect(timeCoords([{t:0,count:1},{t:1,count:2}],4,4).every(c=>Number.isFinite(c.x)&&Number.isFinite(c.y))).toBe(true);
  });
});
