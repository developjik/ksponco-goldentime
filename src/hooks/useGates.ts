import { useEffect, useState } from 'react';
import { isGatesData, type GatesData } from '../lib/gates';

export type GatesState =
  | { status: 'loading' }
  | { status: 'ready'; data: GatesData }
  | { status: 'absent' }
  | { status: 'error'; message: string };

/**
 * 게이트별 집산(public/data/gates-2025.json) 로더.
 * 파일이 아직 없으면(404) 'absent' — UI가 게이트 패널을 그리지 않는다.
 */
export function useGates(url = 'data/gates-2025.json'): GatesState {
  const [state, setState] = useState<GatesState>({ status: 'loading' });

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
        if (!isGatesData(data)) throw new Error('게이트 데이터 형식이 올바르지 않습니다');
        if (alive) setState({ status: 'ready', data });
      })
      .catch((e: unknown) => {
        if (alive) {
          setState({ status: 'error', message: e instanceof Error ? e.message : '알 수 없는 오류' });
        }
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return state;
}
