import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParkingApiError, PARKING_API_URL, fetchParkingNow, parseParkingSum } from './parking';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
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

describe('요청 제한시간과 취소', () => {
  it('재시도도 최초 요청의 제한시간을 공유한다', async()=>{
    vi.useFakeTimers();
    const mock=vi.fn().mockImplementationOnce(()=>new Promise((_,reject)=>setTimeout(()=>reject(new TypeError('network')),90))).mockImplementationOnce(()=>new Promise(()=>{}));
    vi.stubGlobal('fetch',mock);
    const pending=fetchParkingNow(undefined,100);
    const rejected=expect(pending).rejects.toThrow('시간이 초과');
    await vi.advanceTimersByTimeAsync(90);expect(mock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10);await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('끝나지 않는 fetch도 제한시간 후 해제하고 재시도할 수 있다', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const mock = vi.fn((_url: unknown, init: RequestInit) => {signal=init.signal ?? undefined;return new Promise<Response>(()=>{});});
    vi.stubGlobal('fetch',mock);
    const request=fetchParkingNow(undefined,100);
    const rejected=expect(request).rejects.toThrow('시간이 초과');
    await vi.advanceTimersByTimeAsync(100); await rejected;
    expect(signal?.aborted).toBe(true);
    expect(mock).toHaveBeenCalledTimes(1);
    mock.mockResolvedValueOnce(new Response('[{"parking_sum":123}]'));
    expect((await fetchParkingNow(undefined,100)).parkedTotal).toBe(123);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('응답 본문이 멈춰도 제한시간이 적용된다',async()=>{
    vi.useFakeTimers();
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:()=>new Promise(()=>{})}));
    const request=fetchParkingNow(undefined,100);
    const rejected=expect(request).rejects.toThrow('시간이 초과');
    await vi.advanceTimersByTimeAsync(100);await rejected;
  });
  it('외부 취소는 즉시 요청을 끝내고 재시도하지 않는다',async()=>{
    vi.useFakeTimers();
    const mock=vi.fn().mockImplementation(()=>new Promise(()=>{}));vi.stubGlobal('fetch',mock);
    const controller=new AbortController();
    const request=fetchParkingNow(controller.signal,1000);
    controller.abort();
    await expect(request).rejects.toMatchObject({name:'AbortError'});
    expect(mock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('이미 취소된 신호로는 fetch하지 않는다',async()=>{
    const mock=vi.fn();vi.stubGlobal('fetch',mock);const c=new AbortController();c.abort();
    await expect(fetchParkingNow(c.signal)).rejects.toMatchObject({name:'AbortError'});
    expect(mock).not.toHaveBeenCalled();
  });
});
