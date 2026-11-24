import { useCallback, useEffect, useRef, useState } from 'react';
import { ParkingApiError, fetchParkingNow, type ParkingSnapshot } from '../lib/parking';
import { appendPoint, type HistoryPoint } from '../lib/history';

/** 자동 갱신 주기(ms) — 화면 표시(카운트다운)와 같은 값을 쓴다. */
export const POLL_MS = 60_000;

export interface ParkingState {
  snapshot: ParkingSnapshot | null;
  history: HistoryPoint[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * 실시간 주차현황 훅: 즉시 1회 조회 + POLL_MS 간격 폴링 + 수동 새로고침.
 * 탭이 숨겨진 동안엔 폴링을 쉬고, 다시 보이면 마지막 측정이 POLL_MS 이상 묵었을 때 갱신.
 */
export function useParking(pollMs: number = POLL_MS): ParkingState {
  const [snapshot, setSnapshot] = useState<ParkingSnapshot | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const active = useRef(false);
  const lastAt = useRef(0);

  const refresh = useCallback(() => {
    if (!active.current || inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    fetchParkingNow(controller.signal)
      .then((snap) => {
        if (!active.current || inFlight.current !== controller) return;
        lastAt.current = snap.fetchedAt;
        setSnapshot(snap);
        setHistory((h) => appendPoint(h, { t: snap.fetchedAt, count: snap.parkedTotal }));
        setError(null);
      })
      .catch((e: unknown) => {
        if (!active.current || inFlight.current !== controller || controller.signal.aborted) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(
          e instanceof ParkingApiError || e instanceof Error
            ? e.message
            : '알 수 없는 오류가 발생했습니다',
        );
      })
      .finally(() => {
        if (active.current && inFlight.current === controller) {
          inFlight.current = null;
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    active.current = true;
    refresh();
    const id = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, pollMs);
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastAt.current >= pollMs) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active.current = false;
      const request = inFlight.current;
      inFlight.current = null;
      request?.abort();
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, pollMs]);

  return { snapshot, history, loading, error, refresh };
}
