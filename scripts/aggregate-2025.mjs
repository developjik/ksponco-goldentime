// 공공데이터포털 API_CPM_009 전수 수집 → 요일×시간 평균 주차대수 집산.
// 산출물 public/data/pattern-2025.json: 원문 아님(입구별 개인정보 없음), 집산 평균만.
// DESCRIPTION 예: '주차대수:N,방문객:N, 기온:…, 휴일:' / TITLE: '공연명:…,공연관람객수:N'
import { mkdirSync, writeFileSync } from 'node:fs';

const API = 'https://api.kcisa.kr/openapi/API_CPM_009/request';
const KEY = process.env.KSPONCO_LINK_API_KEY;
if (!KEY) {
  console.error('KSPONCO_LINK_API_KEY 시크릿이 없습니다');
  process.exit(1);
}
const CAPACITY = 2800; // 올림픽공원 홈페이지 FAQ 기준 총주차면수

function parseFields(text) {
  // '주차대수:1203,방문객:840, 기온:…' 형태의 느슨한 CSV → 맵
  const out = {};
  for (const part of String(text ?? '').split(/[,]/)) {
    const m = part.match(/^\s*([^:：]+)[:：]\s*(.*?)\s*$/);
    if (m) out[m[1].trim()] = m[2];
  }
  return out;
}

async function fetchPage(pageNo, numOfRows) {
  const url = `${API}?serviceKey=${encodeURIComponent(KEY)}&numOfRows=${numOfRows}&pageNo=${pageNo}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    // resultCode 0000 확인(빈 items/에러 재시도 대상)
    if (xml.includes('<resultCode>0000</resultCode>') || xml.includes('"resultCode":"0000"')) {
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
      return items;
    }
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
  }
  return []; // 4회 모두 실패한 페이지는 건너뜀(로그로 남김)
}

function field(item, name) {
  const m = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : '';
}

const sum = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => [0, 0]));
let total = 0;
let skipped = 0;
const NUM_OF_ROWS = 1000;
for (let pageNo = 1; pageNo <= 30; pageNo += 1) {
  const items = await fetchPage(pageNo, NUM_OF_ROWS);
  if (items.length === 0) {
    console.log(`page ${pageNo}: no items (end or gateway flake)`);
    if (pageNo === 1) throw new Error('first page empty — abort');
    skipped += 1;
    if (skipped >= 2) break; // 연속 빈 페이지 = 끝
    continue;
  }
  skipped = 0;
  for (const item of items) {
    const desc = parseFields(field(item, 'DESCRIPTION'));
    const parked = Number(String(desc['주차대수'] ?? '').replace(/[^0-9]/g, ''));
    const when = field(item, 'ISSUED_DATE') || field(item, 'TITLE'); // '2025-08-24 13:00'류
    const m = when.match(/(20\d{2})-(\d{2})-(\d{2})[T ](\d{2})/);
    if (!Number.isFinite(parked) || parked <= 0 || !m) continue;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const weekday = (d.getDay() + 6) % 7; // 월=0 … 일=6
    const hour = Number(m[4]);
    if (weekday < 0 || weekday > 6 || hour > 23) continue;
    sum[weekday][hour][0] += parked;
    sum[weekday][hour][1] += 1;
    total += 1;
  }
  console.log(`page ${pageNo}: ${items.length} items`);
  if (items.length < NUM_OF_ROWS) break; // 마지막 페이지
}

if (total < 3000) throw new Error(`records too few: ${total} — abort`);

const weekdayHour = sum.map((hours) =>
  hours.map(([s, n]) => (n > 0 ? { avg: Math.round(s / n), samples: n } : null)),
);
const out = {
  source: '공공데이터포털 한국체육산업개발주식회사_실시간 주차현황 연계(API_CPM_009)',
  year: 2025,
  capacity: CAPACITY,
  generatedAt: new Date().toISOString(),
  records: total,
  weekdayHour,
};
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/pattern-2025.json', JSON.stringify(out));
console.log(`aggregated ${total} records → public/data/pattern-2025.json`);
