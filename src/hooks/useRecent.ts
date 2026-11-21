import { useEffect, useState } from 'react';
import type { HistoryPoint } from '../lib/history';
import { parseRecentHistory } from '../lib/recent';

export type RecentState =
  | { status: 'loading' }
  | { status: 'ready'; data: HistoryPoint[] }
  | { status: 'absent' }
  | { status: 'error'; message: string };

/**
 * 최근 24시간 측정 이력(public/data/realtime-history.json) 로더.
 * CI가 30분마다 갱신·커밋하는 파일이다. 아직 없으면(404) 'absent' — UI가 섹션을 그리지 않는다.
 */
export function useRecentHistory(url = 'data/realtime-history.json'): RecentState {
  const [state, setState] = useState<RecentState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 404) {
          if (alive) setState({ status: 'absent' });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: unknown = await res.json();
        if (alive) setState({ status: 'ready', data: parseRecentHistory(data) });
      })
      .catch((e: unknown) => {
        if (alive) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : '알 수 없는 오류',
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return state;
}
