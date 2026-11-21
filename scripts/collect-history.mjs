// 키 불필요 공개 실시간 API → data/realtime-history.json 한 줄 추가(최근 2,000포인트 유지).
// 원문은 저장하지 않고 {시각, 주차대수} 측정값만 남긴다.
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const API_URL =
  process.env.PARKING_API_URL ??
  'https://www.ksponco.or.kr/online/main/parkingorsApi.do?apiKey=PARKING21803504';
const FILE = 'data/realtime-history.json';
const MAX_POINTS = 2000;

async function fetchParking() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(API_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const first = Array.isArray(body) ? body[0] : null;
      const n = Number(first?.parking_sum);
      if (!Number.isFinite(n) || n < 0) throw new Error('bad payload');
      return { t: Date.now(), count: Math.floor(n) };
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
  throw new Error('unreachable');
}

const point = await fetchParking();
let points = [];
try {
  points = JSON.parse(readFileSync(FILE, 'utf8'));
} catch {
  mkdirSync('data', { recursive: true });
}
if (!Array.isArray(points)) points = [];
points.push(point);
if (points.length > MAX_POINTS) points = points.slice(points.length - MAX_POINTS);
writeFileSync(FILE, JSON.stringify(points));
console.log(`history points: ${points.length}, latest: ${point.count}`);
