/**
 * 2025년 게이트별 입출차 집산물(public/data/gates-2025.json) 해석 순수 로직.
 * 스크립트 scripts/aggregate-008.mjs가 만든 집산 파일 대응 — 원문 레코드는 다루지 않는다.
 */

export interface GateHourCell {
  /** 그 (요일, 시간)의 입차 건수 */
  e: number;
  /** 평균 체류시간(분) — 표본이 있을 때만 */
  d?: number;
}

export interface GateFlow {
  name: string;
  /** 연간 입차 건수 */
  entries: number;
  /** [요일(월=0..일=6)][시간(0..23)] */
  weekdayHour: (GateHourCell | null)[][];
}

export interface GatesData {
  source: string;
  year: number;
  records: number;
  totalCount: number;
  generatedAt: string;
  gates: GateFlow[];
}

export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

/** '입구:동2문입구#1' · '입구:남2문CMB' → 정규 게이트명('동2문'·'남2문'). */
export function normalizeGateName(rawEntry: string): string | null {
  const m = rawEntry.match(/^입구:([가-힣0-9]+?)문(?:입구|CMB)/);
  if (!m) return null;
  return `${m[1]}문`;
}

/** 입차·출차 시각('YYYY-MM-DD HH:mm:ss') → 체류시간(분). 어긋나면 null. */
export function dwellMinutes(entry: string, exit: string): number | null {
  const toTs = (s: string) => {
    const m = s.match(/(20\d{2})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : null;
  };
  const a = toTs(entry);
  const b = toTs(exit);
  if (a === null || b === null) return null;
  const min = Math.round((b - a) / 60000);
  // 음수(데이터 오염)·3일 초과(장기 방치)는 통계에서 제외
  return min >= 0 && min <= 4320 ? min : null;
}

export function isGatesData(data: unknown): data is GatesData {
  if (typeof data !== 'object' || data === null) return false;
  const g = data as Partial<GatesData>;
  return (
    typeof g.records === 'number' &&
    Array.isArray(g.gates) &&
    g.gates.every((x) => typeof x?.name === 'string' && Array.isArray(x?.weekdayHour))
  );
}

export interface GateSummary {
  name: string;
  /** 전체 입차 중 비중(%, 반올림) */
  sharePercent: number;
  /** 입차가 가장 몰리는 요일·시간 */
  peak: { weekday: number; hour: number; entries: number };
  /** 전체 평균 체류시간(분) — 가중평균(시간칸 평균을 건수로 가중) */
  avgDwellMin: number | null;
}

/** 게이트 요약: 비중·피크 시간·평균 체류. entries 내림차순 정렬. */
export function summarizeGates(data: GatesData): GateSummary[] {
  const totalEntries = data.gates.reduce((s, g) => s + g.entries, 0) || 1;
  return data.gates
    .map((g) => {
      let peak = { weekday: 0, hour: 0, entries: -1 };
      let dwellSum = 0;
      let dwellWeight = 0;
      for (let d = 0; d < 7; d += 1) {
        const hours = g.weekdayHour[d] ?? [];
        for (let h = 0; h < 24; h += 1) {
          const cell = hours[h];
          if (!cell) continue;
          if (cell.e > peak.entries) peak = { weekday: d, hour: h, entries: cell.e };
          if (typeof cell.d === 'number' && cell.e > 0) {
            dwellSum += cell.d * cell.e;
            dwellWeight += cell.e;
          }
        }
      }
      return {
        name: g.name,
        sharePercent: Math.round((g.entries / totalEntries) * 100),
        peak: peak.entries >= 0 ? peak : { weekday: 0, hour: 0, entries: 0 },
        avgDwellMin: dwellWeight > 0 ? Math.round(dwellSum / dwellWeight) : null,
      };
    })
    .sort((a, b) => b.sharePercent - a.sharePercent);
}

/** 체류시간(분) → '2시간 34분' / '48분'. */
export function formatDwell(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}
