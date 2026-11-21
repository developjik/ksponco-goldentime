// 공공데이터포털 API_CPM_008(입출차 전체구역, 2025년 약 241만 건) 전수 수집 →
// 게이트×요일×시간 입차 건수·평균 체류시간으로 집산해 public/data/gates-2025.json 커밋.
// 원문 레코드는 저장하지 않는다(집산 합만 메모리에 유지).
// 게이트웨이 제한 1req/2s — 2.5초 스로틀 + 429/5xx 백오프 재시도.
import { mkdirSync, writeFileSync } from 'node:fs';

const API = 'https://api.kcisa.kr/openapi/API_CPM_008/request';
const KEY = process.env.KSPONCO_ENTRY_API_KEY;
if (!KEY) {
  console.error('KSPONCO_ENTRY_API_KEY 시크릿이 없습니다');
  process.exit(1);
}
const NUM_OF_ROWS = 2000; // 5천건은 게이트웨이 500 폭주 — 2천건이 총 소요 더 짧음
const MAX_PAGES = 1400; // 2000×1400=280만 > 241만 안전 상한

function parseFields(text) {
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

function field(item, name) {
  const m = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : '';
}

function gateName(rawEntry) {
  const m = String(rawEntry ?? '').match(/^입구:([가-힣0-9]+?)문(?:입구|CMB)/);
  return m ? `${m[1]}문` : null;
}

function dwellMin(entry, exit) {
  const toTs = (s) => {
    const m = String(s ?? '').match(/(20\d{2})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : null;
  };
  const a = toTs(entry);
  const b = toTs(exit);
  if (a === null || b === null) return null;
  const min = Math.round((b - a) / 60000);
  return min >= 0 && min <= 4320 ? min : null; // 음수·3일+ 방치 제외
}

/** 페이지 1회 분량 조회. 끝까지 실패하면 null(건너뜀) — 240만건 전체를 한 페이지 실패로 버리지 않는다. */
async function fetchPage(pageNo) {
  const url = `${API}?serviceKey=${encodeURIComponent(KEY)}&numOfRows=${NUM_OF_ROWS}&pageNo=${pageNo}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let xml = '';
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (attempt < 4) {
          await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
          continue;
        }
        console.log(`page ${pageNo}: HTTP ${res.status} after retries — skip`);
        return null;
      }
      xml = await res.text();
    } catch {
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
        continue;
      }
      console.log(`page ${pageNo}: network error after retries — skip`);
      return null;
    }
    if (xml.includes('<resultCode>0000</resultCode>') || xml.includes('"resultCode":"0000"')) {
      return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
    }
    await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
  }
  console.log(`page ${pageNo}: resultCode not 0000 after retries — skip`);
  return null;
}

// 게이트명 → [요일][시간] { e: 입차건수, ds: 체류합(분), dc: 체류표본 }
const gates = new Map();
let records = 0;
let badPages = 0; // 연속 실패 페이지 — 8연속이면 게이트웨이 장애로 중단

for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
  const items = await fetchPage(pageNo);
  if (items === null) {
    badPages += 1;
    if (badPages >= 8) throw new Error('gateway down: 8 consecutive page failures');
    continue; // 한 페이지 건너뛰고 계속 — 2천건/페이지 기준 손실 0.08%
  }
  badPages = 0;
  if (items.length === 0) break; // 끝
  for (const item of items) {
    const desc = parseFields(field(item, 'DESCRIPTION'));
    const gate = gateName(desc['입구']);
    const when = desc['입차시간'] || field(item, 'ISSUED_DATE');
    const m = String(when ?? '').match(/(20\d{2})-(\d{2})-(\d{2})[T ](\d{2})/);
    if (!gate || !m) continue;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    const weekday = (d.getDay() + 6) % 7; // 월=0 … 일=6
    const hour = +m[4];
    if (weekday < 0 || weekday > 6 || hour > 23) continue;
    if (!gates.has(gate)) {
      gates.set(gate, Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ e: 0, ds: 0, dc: 0 }))));
    }
    const cell = gates.get(gate)[weekday][hour];
    cell.e += 1;
    const dwell = dwellMin(desc['입차시간'], desc['출차시간']);
    if (dwell !== null) {
      cell.ds += dwell;
      cell.dc += 1;
    }
    records += 1;
  }
  if (pageNo === 1) console.log(`page 1: ${items.length} items — starting full crawl`);
  if (pageNo % 25 === 0) console.log(`page ${pageNo}: cumulated ${records} records`);
  if (items.length < NUM_OF_ROWS) break; // 마지막 페이지
  await new Promise((r) => setTimeout(r, 2500)); // 게이트웨이 제한 1req/2s — 여유 스로틀
}

if (records < 2_000_000) throw new Error(`records too few: ${records} — abort (expect ~2.41M)`);

const out = {
  source: '공공데이터포털 한국체육산업개발주식회사_실시간 주차현황 입출차 전체구역(API_CPM_008)',
  year: 2025,
  records,
  totalCount: records,
  generatedAt: new Date().toISOString(),
  gates: [...gates.entries()]
    .map(([name, hours]) => ({
      name,
      entries: hours.flat().reduce((s, c) => s + c.e, 0),
      weekdayHour: hours.map((row) =>
        row.map((c) => (c.e > 0 ? { e: c.e, ...(c.dc > 0 ? { d: Math.round(c.ds / c.dc) } : {}) } : null)),
      ),
    }))
    .sort((a, b) => b.entries - a.entries),
};
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/gates-2025.json', JSON.stringify(out));
console.log(`aggregated ${records} records, ${out.gates.length} gates → public/data/gates-2025.json`);
