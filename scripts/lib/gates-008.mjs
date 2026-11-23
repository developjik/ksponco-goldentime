// API_CPM_008 집산 순수 로직 — 네트워크·파일 I/O 없음(테스트 대상).
// 원문 레코드는 보관하지 않고 게이트×요일×시간 합계만 다룬다.

export const CHECKPOINT_VERSION = 1;

/** DESCRIPTION 등 '키:값,키:값' 느슨한 CSV → 맵. CDATA 래퍼 제거. 시각의 ':'는 값에 남는다. */
export function parseFields(text) {
  const clean = String(text ?? '')
    .replace(/^\s*<!\[CDATA\[/, '')
    .replace(/\]\]>\s*$/, '');
  const out = {};
  for (const part of clean.split(/[,]/)) {
    const m = part.match(/^\s*([^:：]+)[:：]\s*(.*?)\s*$/);
    if (m) out[m[1].trim()] = m[2];
  }
  return out;
}

/** <item> 본문에서 태그 값(CDATA 포함 원문). */
export function field(item, name) {
  const m = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : '';
}

/** <item> 본문의 태그명 목록(샘플 진단용). */
export function fieldNames(item) {
  return [...new Set([...String(item).matchAll(/<([A-Za-z_][\w.-]*)>/g)].map((m) => m[1]))];
}

/**
 * 입구 값 → 정규 게이트명. parseFields가 '입구:동2문입구#1'을 키 '입구'·값 '동2문입구#1'로
 * 쪼개므로 접두 '입구:'는 있어도 없어도 받는다. 차로 번호(#n)·버스 전용(CMB)은 같은 문으로 합친다.
 */
export function gateName(rawEntry) {
  const v = String(rawEntry ?? '')
    .trim()
    .replace(/^입구\s*[:：]\s*/, '');
  const m = v.match(/^([가-힣0-9]+?)문(?:입구|CMB)/);
  return m ? `${m[1]}문` : null;
}

const TS_RE = /(20\d{2})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

/** 입차·출차 시각 → 체류시간(분). 음수·3일 초과(방치)는 null. */
export function dwellMin(entry, exit) {
  const toTs = (s) => {
    const m = String(s ?? '').match(TS_RE);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).getTime() : null;
  };
  const a = toTs(entry);
  const b = toTs(exit);
  if (a === null || b === null) return null;
  const min = Math.round((b - a) / 60000);
  return min >= 0 && min <= 4320 ? min : null;
}

/** 응답 XML → { ok, items, totalCount }. resultCode 0000이 아니면 ok=false. */
export function parsePage(xml) {
  const text = String(xml ?? '');
  const ok = text.includes('<resultCode>0000</resultCode>') || text.includes('"resultCode":"0000"');
  const tc = text.match(/<totalCount>\s*(\d+)\s*<\/totalCount>/) ?? text.match(/"totalCount"\s*:\s*"?(\d+)/);
  return {
    ok,
    items: ok ? [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]) : [],
    totalCount: tc ? Number(tc[1]) : null,
  };
}

/** 레코드 1건 → { gate, weekday, hour, year, dwell } 또는 { skip: 사유 }. */
export function classifyItem(item) {
  const desc = parseFields(field(item, 'DESCRIPTION'));
  const rawEntry = desc['입구'] ?? field(item, 'DESCRIPTION').match(/입구\s*[:：]\s*([^,\]]+)/)?.[1];
  const gate = gateName(rawEntry);
  if (!gate) return { skip: 'noGate' };
  const when = desc['입차시간'] || field(item, 'ISSUED_DATE');
  const m = String(when ?? '').match(TS_RE);
  if (!m) return { skip: 'noTime' };
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const hour = +m[4];
  if (Number.isNaN(d.getTime()) || hour > 23) return { skip: 'noTime' };
  return {
    gate,
    year: +m[1],
    weekday: (d.getDay() + 6) % 7, // 월=0 … 일=6
    hour,
    dwell: dwellMin(desc['입차시간'], desc['출차시간']),
  };
}

/** 빈 집산 상태. gates: { 게이트: [요일][시간] = [입차, 체류합, 체류표본] } */
export function emptyAgg() {
  return { records: 0, skipped: { noGate: 0, noTime: 0, otherYear: 0 }, gates: {} };
}

/** 한 페이지 분량을 집산 상태에 누적. 반환: 이 페이지에서 집계된 건수. */
export function accumulate(agg, items, year) {
  let matched = 0;
  for (const item of items) {
    const r = classifyItem(item);
    if (r.skip) {
      agg.skipped[r.skip] += 1;
      continue;
    }
    if (r.year !== year) {
      agg.skipped.otherYear += 1;
      continue;
    }
    agg.gates[r.gate] ??= Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => [0, 0, 0]));
    const cell = agg.gates[r.gate][r.weekday][r.hour];
    cell[0] += 1;
    if (r.dwell !== null) {
      cell[1] += r.dwell;
      cell[2] += 1;
    }
    matched += 1;
  }
  agg.records += matched;
  return matched;
}

/** 진단용 샘플 — 차량번호 등 개인정보 가능 값은 길이만 남기고 가린다. */
export function maskedSample(item) {
  const desc = parseFields(field(item, 'DESCRIPTION'));
  const keep = /입구|출구|시간|일시|구역|게이트/;
  return {
    tags: fieldNames(item),
    description: Object.fromEntries(
      Object.entries(desc).map(([k, v]) => [k, keep.test(k) ? v : `<${String(v).length}자 가림>`]),
    ),
    ISSUED_DATE: field(item, 'ISSUED_DATE') || undefined,
  };
}

/** 정수 집합 ↔ 구간 배열 [[a,b],…] (체크포인트 크기 절감). */
export function toRanges(nums) {
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  const out = [];
  for (const n of sorted) {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else out.push([n, n]);
  }
  return out;
}

export function fromRanges(ranges) {
  const out = new Set();
  for (const [a, b] of ranges ?? []) for (let n = a; n <= b; n += 1) out.add(n);
  return out;
}

/** 새 체크포인트(진행 상태 + 집산 합). */
export function newCheckpoint({ year, numOfRows, totalCount }) {
  return {
    version: CHECKPOINT_VERSION,
    year,
    numOfRows,
    totalCount,
    totalPages: totalCount === null ? null : Math.ceil(totalCount / numOfRows),
    done: new Set(),
    failCounts: {},
    agg: emptyAgg(),
    runs: 0,
    complete: false,
  };
}

export function serializeCheckpoint(cp) {
  return JSON.stringify({ ...cp, done: toRanges([...cp.done]), updatedAt: new Date().toISOString() });
}

/** 체크포인트 복원. 수집 조건(연도·페이지 크기·전체 건수)이 다르면 null(새로 시작). */
export function restoreCheckpoint(json, { year, numOfRows, totalCount }) {
  let raw;
  try {
    raw = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    return null;
  }
  if (!raw || raw.version !== CHECKPOINT_VERSION) return null;
  if (raw.year !== year || raw.numOfRows !== numOfRows) return null;
  if (totalCount !== null && raw.totalCount !== totalCount) return null;
  return { ...raw, done: fromRanges(raw.done), failCounts: raw.failCounts ?? {} };
}

/** 남은 페이지(미완료) — 오름차순. */
export function pendingPages(cp) {
  const out = [];
  for (let p = 1; p <= cp.totalPages; p += 1) if (!cp.done.has(p)) out.push(p);
  return out;
}

/** 최종 산출물(public/data/gates-2025.json) — 기존 스키마(src/lib/gates.ts GatesData) 유지. */
export function buildOutput(cp, source) {
  return {
    source,
    year: cp.year,
    records: cp.agg.records,
    totalCount: cp.totalCount ?? cp.agg.records,
    generatedAt: new Date().toISOString(),
    gates: Object.entries(cp.agg.gates)
      .map(([name, hours]) => ({
        name,
        entries: hours.flat().reduce((s, c) => s + c[0], 0),
        weekdayHour: hours.map((row) =>
          row.map((c) => (c[0] > 0 ? { e: c[0], ...(c[2] > 0 ? { d: Math.round(c[1] / c[2]) } : {}) } : null)),
        ),
      }))
      .sort((a, b) => b.entries - a.entries),
  };
}
