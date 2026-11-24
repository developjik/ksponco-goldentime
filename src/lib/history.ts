/**
 * 세션 내 추이(스파크라인) 순수 로직.
 * 측정 이력은 메모리(React state)에만 저장 — 페이지 새로고침 시 리셋됨이 명세.
 */

export interface HistoryPoint {
  /** 측정 시각(epoch ms) */
  t: number;
  /** 그 시각의 전체 주차대수 */
  count: number;
}

/** 60초 폴링 기준 12시간치 상한. */
export const MAX_HISTORY = 720;

/** 이력에 측정 포인트 추가. 상한 초과분은 오래된 것부터 버린다. */
export function appendPoint(
  points: HistoryPoint[],
  point: HistoryPoint,
  cap: number = MAX_HISTORY,
): HistoryPoint[] {
  const next = [...points, point];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** 관측 시작 대비 순변화(마지막 - 첫째). 포인트 2개 미만이면 null. */
export function netChange(points: HistoryPoint[]): number | null {
  if (points.length < 2) return null;
  return points[points.length - 1].count - points[0].count;
}

/** 직전 측정 대비 변화 방향·크기. 포인트 2개 미만이면 null. */
export function lastChange(points: HistoryPoint[]): {
  dir: 'up' | 'down' | 'flat';
  amount: number;
} | null {
  if (points.length < 2) return null;
  const amount = points[points.length - 1].count - points[points.length - 2].count;
  return { dir: amount > 0 ? 'up' : amount < 0 ? 'down' : 'flat', amount };
}

export interface Coord {
  x: number;
  y: number;
}

/**
 * 스파크라인 좌표(좌상단 원점, 지정 폭·높이, 패딩 포함).
 * x는 포인트 인덱스 균등 간격(측정 간격이 일정하지 않아도 모양 안 무너짐),
 * y는 count의 min~max 정규화. min==max면 중앙 수평선, 포인트 1개면 중앙 점.
 */
export function sparkCoords(
  points: HistoryPoint[],
  width: number,
  height: number,
  pad = 6,
): Coord[] {
  if (points.length === 0) return [];
  const innerW = Math.max(width - pad * 2, 0);
  const innerH = Math.max(height - pad * 2, 0);
  const counts = points.map((p) => p.count);
  const minY = Math.min(...counts);
  const maxY = Math.max(...counts);
  const spanY = maxY - minY;
  const midY = pad + innerH / 2;
  if (points.length === 1) return [{ x: width / 2, y: midY }];
  return points.map((p, i) => ({
    x: pad + (i / (points.length - 1)) * innerW,
    y: spanY === 0 ? midY : pad + (1 - (p.count - minY) / spanY) * innerH,
  }));
}

/** 시간 오름차순·동일 시각 마지막 값. 잘못된 수치는 좌표로 내보내지 않는다. */
export function timePoints(points: HistoryPoint[]): HistoryPoint[] {
  const unique = new Map<number, HistoryPoint>();
  for (const p of points) if (Number.isFinite(p.t) && Number.isFinite(p.count)) unique.set(p.t, p);
  return [...unique.values()].sort((a, b) => a.t - b.t);
}

/** 실제 경과시간 비율을 x축에 반영한다. 동일 시각/한 점은 중앙이다. */
export function timeCoords(points: HistoryPoint[], width: number, height: number, pad = 6): Coord[] {
  const normalized = timePoints(points);
  const ys = sparkCoords(normalized, width, height, pad);
  const span = normalized.length ? normalized[normalized.length - 1].t - normalized[0].t : 0;
  const inner = Math.max(width - 2 * pad, 0);
  return normalized.map((p, i) => ({
    x: span === 0 ? width / 2 : pad + ((p.t - normalized[0].t) / span) * inner,
    y: ys[i].y,
  }));
}

/** 수집 예정 간격 30분의 1.5배를 넘으면 연결하지 않는다. */
export const HISTORY_GAP_MS = 45 * 60 * 1000;
export function timeSegments(points: HistoryPoint[], gapMs = HISTORY_GAP_MS): HistoryPoint[][] {
  const segments: HistoryPoint[][] = [];
  for (const point of timePoints(points)) {
    const last = segments[segments.length - 1];
    if (!last || point.t - last[last.length - 1].t > gapMs) segments.push([point]);
    else last.push(point);
  }
  return segments;
}
