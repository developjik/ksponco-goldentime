import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParkingApiError, PARKING_API_URL, fetchParkingNow, parseParkingSum } from './parking';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchParkingNow — 재시도', () => {
  it('첫 호출이 실패해도 1회 재시도로 복구한다', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ parking_sum: 2008 }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const snap = await fetchParkingNow();
    expect(snap.parkedTotal).toBe(2008);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('두 번 다 실패하면 사용자 친화적 오류로 바꾼다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('network down')),
    );
    await expect(fetchParkingNow()).rejects.toThrow(ParkingApiError);
  });
});

describe('parseParkingSum — API 응답 검증', () => {
  it('정상 응답 [{parking_sum: 2008}]에서 숫자를 꺼낸다', () => {
    expect(parseParkingSum([{ parking_sum: 2008 }])).toBe(2008);
  });

  it('문자열 숫자도 허용한다', () => {
    expect(parseParkingSum([{ parking_sum: '1500' }])).toBe(1500);
  });

  it('소수는 내림해 정수로 만든다', () => {
    expect(parseParkingSum([{ parking_sum: 2008.9 }])).toBe(2008);
  });

  it('빈 배열이면 ParkingApiError', () => {
    expect(() => parseParkingSum([])).toThrow(ParkingApiError);
  });

  it('배열이 아니면 ParkingApiError', () => {
    expect(() => parseParkingSum({ parking_sum: 1 })).toThrow(ParkingApiError);
    expect(() => parseParkingSum(null)).toThrow(ParkingApiError);
  });

  it('첫 요소가 객체가 아니면 ParkingApiError', () => {
    expect(() => parseParkingSum([3])).toThrow(ParkingApiError);
    expect(() => parseParkingSum([null])).toThrow(ParkingApiError);
  });

  it('parking_sum이 없거나 숫자가 아니면 ParkingApiError', () => {
    expect(() => parseParkingSum([{}])).toThrow(ParkingApiError);
    expect(() => parseParkingSum([{ parking_sum: 'abc' }])).toThrow(ParkingApiError);
    expect(() => parseParkingSum([{ parking_sum: null }])).toThrow(ParkingApiError);
  });

  it('음수는 거절한다', () => {
    expect(() => parseParkingSum([{ parking_sum: -1 }])).toThrow(ParkingApiError);
  });
});

describe('PARKING_API_URL 상수', () => {
  it('검증된 공개 API 주소를 가리킨다', () => {
    expect(PARKING_API_URL).toBe(
      'https://www.ksponco.or.kr/online/main/parkingorsApi.do?apiKey=PARKING21803504',
    );
  });
});
