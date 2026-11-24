import { useEffect, useState } from 'react';
import type { HistoryPoint } from '../lib/history';
import { parseRecentHistory } from '../lib/recent';

export const RECENT_REFRESH_MS = 30 * 60 * 1000;
export const RECENT_STALE_MS = 45 * 60 * 1000;
export type RecentState =
  | { status: 'loading' }
  | { status: 'ready'; data: HistoryPoint[]; checkedAt: number; stale: boolean; refreshError?: string }
  | { status: 'absent' }
  | { status: 'error'; message: string };

/** 30분 주기·탭 복귀 갱신. 실패해도 마지막 성공 이력은 유지한다. */
export function useRecentHistory(url = 'data/realtime-history.json'): RecentState {
  const [state, setState] = useState<RecentState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    let pending: AbortController | null = null;
    let lastData: HistoryPoint[] | null = null;
    setState({ status: 'loading' });
    const publish = (error?: string) => {
      if (!alive || !lastData) return;
      const last = lastData[lastData.length - 1];
      setState({ status: 'ready', data: lastData, checkedAt: Date.now(),
        stale: !last || Date.now() - last.t > RECENT_STALE_MS,
        ...(error ? { refreshError: error } : {}) });
    };
    const refresh = async () => {
      if (!alive || pending || document.hidden) return;
      const controller = new AbortController();
      pending = controller;
      let timeout: ReturnType<typeof setTimeout>;
      const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new Error('이력 요청 시간이 초과되었습니다')); }, 10_000); });
      try {
        const res = await Promise.race([fetch(url, { cache: 'no-store', signal: controller.signal }), deadline]);
        if (!res.ok) {
          if (res.status === 404 && !lastData) { if (alive) setState({ status: 'absent' }); return; }
          throw new Error(`HTTP ${res.status}`);
        }
        const raw: unknown = await Promise.race([res.json(), deadline]);
        if (!alive || controller.signal.aborted) return;
        lastData = parseRecentHistory(raw);
        publish();
      } catch (e) {
        if (!alive) return;
        const message = controller.signal.aborted ? '이력 요청 시간이 초과되었습니다' : e instanceof Error ? e.message : '알 수 없는 오류';
        if (lastData) publish(message);
        else setState({ status: 'error', message });
      } finally {
        clearTimeout(timeout!);
        if (pending === controller) pending = null;
      }
    };
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, RECENT_REFRESH_MS);
    const age = window.setInterval(() => {
      if (document.hidden) return;
      if (lastData) setState(current => current.status === 'ready' ? { ...current,
        stale: !lastData!.length || Date.now() - lastData![lastData!.length - 1].t > RECENT_STALE_MS } : current);
    }, 60_000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { alive = false; pending?.abort(); window.clearInterval(interval); window.clearInterval(age); document.removeEventListener('visibilitychange', visible); };
  }, [url]);
  return state;
}
