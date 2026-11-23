// 공공데이터포털 API_CPM_008(입출차 전체구역, 2025년 약 241만 건) 전수 수집 →
// 게이트×요일×시간 입차 건수·평균 체류시간으로 집산해 public/data/gates-2025.json 생성.
// 원문 레코드는 저장하지 않는다(집산 합만 메모리·체크포인트에 유지).
//
// 5시간 잡 제한 대응:
// - 체크포인트(data/gates-2025.checkpoint.json)에 완료 페이지·집산 합을 저장하고 다음 실행이 이어 받는다.
// - TIME_BUDGET_MIN이 지나면 새 요청을 멈추고 체크포인트만 저장(complete=false)한다.
// - 요청 시작 간격(MIN_INTERVAL_MS, 게이트웨이 1req/2s)은 지키면서 CONCURRENCY개를 동시에 띄워
//   응답 대기(~26초/페이지)를 겹친다.
//
// 환경변수: KSPONCO_ENTRY_API_KEY(필수) · DRY_RUN_PAGES(>0이면 N페이지만 조회, 파일 미기록)
//          CONCURRENCY(4) · MIN_INTERVAL_MS(2500) · TIME_BUDGET_MIN(260) · RESET('true'면 체크포인트 무시)
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  accumulate,
  buildOutput,
  emptyAgg,
  maskedSample,
  newCheckpoint,
  parsePage,
  pendingPages,
  restoreCheckpoint,
  serializeCheckpoint,
} from './lib/gates-008.mjs';

const API = process.env.API_008_URL || 'https://api.kcisa.kr/openapi/API_CPM_008/request'; // 테스트용 목 서버 주입
const SOURCE = '공공데이터포털 한국체육산업개발주식회사_실시간 주차현황 입출차 전체구역(API_CPM_008)';
const KEY = process.env.KSPONCO_ENTRY_API_KEY;
if (!KEY) {
  console.error('KSPONCO_ENTRY_API_KEY 시크릿이 없습니다');
  process.exit(1);
}
const int = (v, d) => (Number.isFinite(Number.parseInt(v, 10)) ? Number.parseInt(v, 10) : d);
const YEAR = 2025;
const NUM_OF_ROWS = 2000; // 5천건은 게이트웨이 500 폭주
const FALLBACK_PAGES = 1400; // totalCount 미제공 시 상한(2000×1400=280만)
const DRY_RUN_PAGES = int(process.env.DRY_RUN_PAGES, 0);
const CONCURRENCY = Math.max(1, int(process.env.CONCURRENCY, 4));
const MIN_INTERVAL_MS = Math.max(0, int(process.env.MIN_INTERVAL_MS, 2500));
const TIME_BUDGET_MS = (Number(process.env.TIME_BUDGET_MIN) || 260) * 60_000;
const RESET = process.env.RESET === 'true';
const CHECKPOINT = process.env.CHECKPOINT_PATH || 'data/gates-2025.checkpoint.json';
const OUT = 'public/data/gates-2025.json';
const ABANDON_AFTER = 3; // 한 페이지가 이만큼(각 5회 재시도) 실패하면 포기
const MAX_MISSING_RATIO = 0.005; // 포기 페이지 0.5% 이하면 최종 산출 허용
const FAIL_FAST_PAGES = 3; // 이만큼 처리했는데 집계 0건이면 계약 불일치로 즉시 중단

const started = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const elapsed = () => `${Math.round((Date.now() - started) / 60000)}분`;

// 전역 요청 시작 간격 — 동시 요청이어도 시작은 MIN_INTERVAL_MS 간격. 429/5xx는 전체 쿨다운.
let nextSlot = 0;
async function takeSlot() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + MIN_INTERVAL_MS;
  if (at > now) await sleep(at - now);
}
function cooldown(ms) {
  nextSlot = Math.max(nextSlot, Date.now() + ms);
}

/** 페이지 1회 조회(5회 재시도). 끝까지 실패하면 null. */
async function fetchPage(pageNo) {
  const url = `${API}?serviceKey=${encodeURIComponent(KEY)}&numOfRows=${NUM_OF_ROWS}&pageNo=${pageNo}`;
  let last = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await takeSlot();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) {
        last = `HTTP ${res.status}`;
        cooldown(8000 * (attempt + 1));
        continue;
      }
      const page = parsePage(await res.text());
      if (page.ok) return page;
      last = 'resultCode not 0000';
    } catch (e) {
      last = `network error (${e?.name ?? 'Error'})`;
    }
    cooldown(8000 * (attempt + 1));
  }
  console.log(`page ${pageNo}: ${last} after retries`);
  return null;
}

/** 큐의 페이지를 CONCURRENCY개 워커로 처리. onPage(p, page|null) → false를 돌려주면 전체 중단. */
async function runPool(queue, onPage, shouldStop) {
  const worker = async () => {
    while (queue.length > 0 && !shouldStop()) {
      const p = queue.shift();
      const page = await fetchPage(p);
      if ((await onPage(p, page)) === false) return;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function saveCheckpoint(cp) {
  mkdirSync(dirname(CHECKPOINT), { recursive: true });
  writeFileSync(`${CHECKPOINT}.tmp`, serializeCheckpoint(cp));
  renameSync(`${CHECKPOINT}.tmp`, CHECKPOINT);
}

function contractError(agg, sample) {
  return new Error(
    `응답 계약 불일치 의심: 처리 레코드 ${agg.records}건, 제외 ${JSON.stringify(agg.skipped)}\n` +
      `샘플(가림): ${JSON.stringify(sample)}`,
  );
}

const first = await fetchPage(1);
if (!first) throw new Error('page 1 failed — gateway down?');
const sample = first.items[0] ? maskedSample(first.items[0]) : null;
console.log(`page 1: ${first.items.length} items, totalCount=${first.totalCount ?? '미제공'}`);
console.log(`sample(가림): ${JSON.stringify(sample)}`);

// ── 드라이런: 1..N페이지만 조회해 누적 건수 확인, 파일 미기록 ─────────────────
if (DRY_RUN_PAGES > 0) {
  const agg = emptyAgg();
  const perPage = new Map([[1, { items: first.items.length, matched: accumulate(agg, first.items, YEAR) }]]);
  const queue = Array.from({ length: DRY_RUN_PAGES - 1 }, (_, i) => i + 2);
  await runPool(
    queue,
    (p, page) => {
      perPage.set(p, page ? { items: page.items.length, matched: accumulate(agg, page.items, YEAR) } : null);
    },
    () => false,
  );
  let cum = 0;
  for (const p of [...perPage.keys()].sort((a, b) => a - b)) {
    const r = perPage.get(p);
    if (r) cum += r.matched;
    console.log(r ? `page ${p}: ${r.items} items, matched ${r.matched}, cumulated ${cum} records` : `page ${p}: failed`);
  }
  const gates = Object.entries(agg.gates)
    .map(([name, h]) => [name, h.flat().reduce((s, c) => s + c[0], 0)])
    .sort((a, b) => b[1] - a[1]);
  console.log(`dry-run ${DRY_RUN_PAGES} pages: cumulated ${agg.records} records, skipped ${JSON.stringify(agg.skipped)}`);
  console.log(`gates: ${gates.map(([n, c]) => `${n}=${c}`).join(', ')}`);
  console.log(`elapsed ${((Date.now() - started) / 1000).toFixed(1)}s (concurrency ${CONCURRENCY})`);
  if (agg.records === 0) throw contractError(agg, sample);
  process.exit(0);
}

// ── 전수 수집(체크포인트 이어받기) ────────────────────────────────────────────
const meta = { year: YEAR, numOfRows: NUM_OF_ROWS, totalCount: first.totalCount };
let cp = null;
if (!RESET && existsSync(CHECKPOINT)) {
  cp = restoreCheckpoint(readFileSync(CHECKPOINT, 'utf8'), meta);
  console.log(cp ? `checkpoint: ${cp.done.size}/${cp.totalPages} pages done, ${cp.agg.records} records` : 'checkpoint 조건 불일치 — 새로 시작');
}
cp ??= newCheckpoint(meta);
cp.totalPages ??= FALLBACK_PAGES;
cp.runs += 1;
cp.complete = false;

const markPage = (p, page) => {
  accumulate(cp.agg, page.items, YEAR);
  cp.done.add(p);
  delete cp.failCounts[p];
  if (first.totalCount === null && page.items.length < NUM_OF_ROWS) cp.totalPages = Math.min(cp.totalPages, p);
};
if (!cp.done.has(1)) markPage(1, first);

const queue = pendingPages(cp).filter((p) => (cp.failCounts[p] ?? 0) < ABANDON_AFTER);
console.log(`run #${cp.runs}: ${queue.length} pages to fetch (concurrency ${CONCURRENCY}, budget ${TIME_BUDGET_MS / 60000}분)`);

let processed = 0;
let consecutiveFail = 0;
let gatewayDown = false;
let contractBroken = false;
await runPool(
  queue,
  (p, page) => {
    if (page === null) {
      cp.failCounts[p] = (cp.failCounts[p] ?? 0) + 1;
      if (cp.failCounts[p] < ABANDON_AFTER) queue.push(p); // 이번 실행 끝에 한 번 더
      consecutiveFail += 1;
      if (consecutiveFail >= 8 * CONCURRENCY) gatewayDown = true;
      return !gatewayDown;
    }
    consecutiveFail = 0;
    if (p <= cp.totalPages) markPage(p, page);
    processed += 1;
    if (cp.done.size >= FAIL_FAST_PAGES && cp.agg.records === 0) {
      contractBroken = true;
      return false;
    }
    if (processed % 25 === 0) {
      console.log(`pages ${cp.done.size}/${cp.totalPages}: cumulated ${cp.agg.records} records (${elapsed()})`);
      saveCheckpoint(cp);
    }
    return true;
  },
  () => gatewayDown || contractBroken || Date.now() - started > TIME_BUDGET_MS,
);

if (contractBroken) throw contractError(cp.agg, sample); // 0건 체크포인트는 저장하지 않는다

const remaining = pendingPages(cp);
const abandoned = remaining.filter((p) => (cp.failCounts[p] ?? 0) >= ABANDON_AFTER);
const unfinished = remaining.length - abandoned.length;
console.log(
  `run #${cp.runs} end (${elapsed()}): ${cp.done.size}/${cp.totalPages} pages, cumulated ${cp.agg.records} records, ` +
    `skipped ${JSON.stringify(cp.agg.skipped)}, unfinished ${unfinished}, abandoned ${abandoned.length}`,
);

if (unfinished > 0) {
  saveCheckpoint(cp);
  setOutput('complete', 'false');
  if (gatewayDown) {
    console.error('gateway down: 연속 실패 — 체크포인트 저장 후 중단(재실행 시 이어받음)');
    process.exitCode = 1;
  } else {
    console.log(`시간 예산 소진 — 체크포인트 저장(${CHECKPOINT}), 다음 실행이 이어받음`);
  }
} else {
  if (abandoned.length / cp.totalPages > MAX_MISSING_RATIO) {
    saveCheckpoint(cp);
    setOutput('complete', 'false');
    throw new Error(`포기 페이지 과다 ${abandoned.length}/${cp.totalPages}: ${abandoned.slice(0, 20).join(',')}`);
  }
  if (cp.agg.records === 0) throw contractError(cp.agg, sample);
  cp.complete = true;
  saveCheckpoint(cp);
  const out = buildOutput(cp, SOURCE);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  setOutput('complete', 'true');
  console.log(`aggregated ${out.records} records, ${out.gates.length} gates → ${OUT}`);
}
