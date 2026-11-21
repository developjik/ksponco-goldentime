/**
 * 한국체육산업개발(주) 올림픽공원 실시간 주차현황 공개 API 클라이언트.
 * 응답 예: [{"parking_sum":2008}] — 전체 주차대수 합계 1개 숫자.
 * CORS Access-Control-Allow-Origin: * 실측(2026-11-21) — 브라우저 직접 호출 가능.
 */
export const PARKING_API_URL =
  'https://www.ksponco.or.kr/online/main/parkingorsApi.do?apiKey=PARKING21803504';

export interface ParkingSnapshot {
  /** 응답을 받은 시각(epoch ms) */
  fetchedAt: number;
  /** 전체 주차대수 합계 */
  parkedTotal: number;
}

export class ParkingApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParkingApiError';
  }
}

/** API 응답 본문 → 전체 주차대수. 형식이 어긋나면 ParkingApiError. */
export function parseParkingSum(data: unknown): number {
  if (!Array.isArray(data) || data.length === 0) {
    throw new ParkingApiError('주차현황 응답이 비어 있습니다');
  }
  const first = data[0];
  if (typeof first !== 'object' || first === null) {
    throw new ParkingApiError('주차현황 응답 형식이 올바르지 않습니다');
  }
  const raw = (first as Record<string, unknown>).parking_sum;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    throw new ParkingApiError('주차현황 숫자값을 읽을 수 없습니다');
  }
  return Math.floor(n);
}

/** 실시간 주차현황 1회 조회. */
export async function fetchParkingNow(signal?: AbortSignal): Promise<ParkingSnapshot> {
  let res: Response;
  try {
    res = await fetch(PARKING_API_URL, { signal, cache: 'no-store' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ParkingApiError('네트워크 오류로 주차현황을 가져올 수 없습니다');
  }
  if (!res.ok) {
    throw new ParkingApiError(`주차현황 서버 오류 (HTTP ${res.status})`);
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ParkingApiError('주차현황 응답을 해석할 수 없습니다');
  }
  return { fetchedAt: Date.now(), parkedTotal: parseParkingSum(data) };
}
