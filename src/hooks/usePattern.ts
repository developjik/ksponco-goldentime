import { useEffect, useState } from 'react';
import { isParkingPattern, type ParkingPattern } from '../lib/pattern';

export type PatternState =
  | { status: 'loading' }
  | { status: 'ready'; pattern: ParkingPattern }
  | { status: 'absent' }
  | { status: 'error'; message: string };

/**
 * 집산 패턴(public/data/pattern-2025.json) 로더.
 * 파일이 아직 없으면(404) 'absent' — 예측 페이지가 준비 중 상태를 그린다.
 */
export function usePattern(url = 'data/pattern-2025.json'): PatternState {
  const [state, setState] = useState<PatternState>({ status: 'loading' });

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
        if (!isParkingPattern(data)) throw new Error('패턴 데이터 형식이 올바르지 않습니다');
        if (alive) setState({ status: 'ready', pattern: data });
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
