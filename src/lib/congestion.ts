/**
 * 혼잡도 측정·표시 순수 로직.
 * 임계값(40/70/85%)은 공식 기준이 아닌 본 서비스 자체 기준이다.
 */

/** 올림픽공원 전체 주차 수용 능력(약 2,800대). */
export const TOTAL_CAPACITY = 2800;

/** 총주차면수 출처 — 올림픽공원 홈페이지 자주하는 질문. */
export const TOTAL_CAPACITY_SOURCE = {
  label: '올림픽공원 홈페이지 자주하는 질문 "2,800여 대"',
  url: 'https://www.ksponco.or.kr/olympicpark/customFaq/list?mid=a20701000000&search=%EC%A3%BC%EC%B0%A8',
};

export type CongestionLevel = '여유' | '보통' | '혼잡' | '매우 혼잡';

/** 주차대수 → 재차율(%, 반올림). 유효하지 않은 입력은 0. */
export function occupancyPercent(parked: number, capacity: number = TOTAL_CAPACITY): number {
  if (!Number.isFinite(parked) || parked < 0) return 0;
  if (!Number.isFinite(capacity) || capacity <= 0) return 0;
  return Math.round((parked / capacity) * 100);
}

/** 재차율(%) → 혼잡 단계. 경계값은 상위 단계로 편입(40%→보통, 70%→혼잡, 85%→매우 혼잡). */
export function congestionLevel(percent: number): CongestionLevel {
  if (!Number.isFinite(percent)) return '여유';
  if (percent >= 85) return '매우 혼잡';
  if (percent >= 70) return '혼잡';
  if (percent >= 40) return '보통';
  return '여유';
}

/** 천 단위 콤마 포함 문자열(환경 로케일과 무관하게 결정적). */
export function formatCount(n: number): string {
  const s = Math.round(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** epoch(ms) → HH:mm:ss(현지 시간). */
export function formatClock(ts: number): string {
  const d = new Date(ts);
  const p = (v: number) => v.toString().padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 부호 포함 변화량 문자열. 예: "+123", "-45", "0". */
export function formatDelta(n: number): string {
  const s = formatCount(Math.abs(n));
  return n > 0 ? `+${s}` : n < 0 ? `-${s}` : s;
}
