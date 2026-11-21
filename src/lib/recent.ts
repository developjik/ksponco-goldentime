/**
 * 최근 24시간 추이 순수 로직.
 * CI(refresh-history)가 30분마다 public/data/realtime-history.json에 커밋하는
 * 측정 이력을 검증·정규화해 그래프에 맞는 형태로 가공한다.
 */
import type { HistoryPoint } from './history';

/** 추이 창 크기(24시간, ms). */
export const WINDOW_MS = 24 * 60 * 60 * 1000;

/** 그래프에 그릴 최대 포인트 수(30분 간격 48개 + 여유). */
export const MAX_CHART_POINTS = 96;

/** 서버 시각 어긋남 허용치(앞선 측정도 창에 담는다). */
export const SKEW_MS = 2 * 60 * 1000;

/**
 * 원문 JSON 배열 → 검증된 포인트열. 잘못된 항목은 건너뛰고,
 * 시각 오름차순으로 정렬하며 같은 시각은 마지막 값으로 덮는다.
 * 배열 자체가 아니면 예외를 던진다.
 */
export function parseRecentHistory(raw: unknown): HistoryPoint[] {
  if (!Array.isArray(raw)) throw new Error('최근 이력 형식이 올바르지 않습니다');
  const valid: HistoryPoint[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { t, count } = item as { t: unknown; count: unknown };
    const ts = Number(t);
    const n = Number(count);
    if (!Number.isFinite(ts) || !Number.isFinite(n) || ts <= 0 || n < 0) continue;
    valid.push({ t: Math.floor(ts), count: Math.floor(n) });
  }
  valid.sort((a, b) => a.t - b.t);
  return valid.filter((p, i) => i === valid.length - 1 || valid[i + 1].t !== p.t);
}

/** now를 기준으로 최근 windowMs 안의 포인트만 남긴다(살짝 앞선 측정 허용). */
export function windowRecent(
  points: HistoryPoint[],
  now: number = Date.now(),
  windowMs: number = WINDOW_MS,
): HistoryPoint[] {
  return points.filter((p) => p.t >= now - windowMs && p.t <= now + SKEW_MS);
}

/**
 * 포인트가 cap을 넘으면 양끝을 포함해 균등하게 추출한다.
 * 시각 순서는 그대로 유지된다.
 */
export function downsample(points: HistoryPoint[], cap: number = MAX_CHART_POINTS): HistoryPoint[] {
  if (points.length <= cap) return points;
  const step = (points.length - 1) / (cap - 1);
  const out: HistoryPoint[] = [];
  for (let i = 0; i < cap; i += 1) out.push(points[Math.round(i * step)]);
  return out;
}

/**
 * 지금 화면의 실시간 측정값을 이력 끝에 붙인다.
 * 이력 마지막보다 새로울 때만(같거나 오래 되면 무시).
 */
export function mergeLivePoint(points: HistoryPoint[], live: HistoryPoint | null): HistoryPoint[] {
  if (!live) return points;
  const last = points[points.length - 1];
  if (!last) return [live];
  if (live.t <= last.t) return points;
  return [...points, live];
}
