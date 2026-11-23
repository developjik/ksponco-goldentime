// 예측 백테스트: public/data/pattern-2025.json(예측) vs public/data/realtime-history.json(실측).
// 채점 로직은 앱과 같은 src/lib/backtest.ts를 Vite 러너로 불러 쓴다(Node 20 호환).
// 사용: npm run backtest [-- --json]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = async (rel) => (await runnerImport(`${root}${rel}`, { configFile: false, logLevel: 'silent' })).module;
const { backtest, summaryLine } = await load('src/lib/backtest.ts');
const { parseRecentHistory } = await load('src/lib/recent.ts');

const pattern = JSON.parse(readFileSync(process.env.PATTERN_FILE ?? `${root}public/data/pattern-2025.json`, 'utf8'));
const history = parseRecentHistory(
  JSON.parse(readFileSync(process.env.HISTORY_FILE ?? `${root}public/data/realtime-history.json`, 'utf8')),
);
const r = backtest(pattern, history);

if (process.argv.includes('--json')) {
  const { cells: _cells, ...rest } = r;
  console.log(JSON.stringify({ ...rest, summary: summaryLine(r, pattern.year) }, null, 2));
} else {
  console.log(`status: ${r.status}`);
  console.log(`MAE: ${r.mae === null ? '-' : `${r.mae.toFixed(1)}%p`}`);
  console.log(`bias(measured-predicted): ${r.bias === null ? '-' : `${r.bias > 0 ? '+' : ''}${r.bias.toFixed(1)}%p`}`);
  console.log(`spearman: ${r.spearman === null ? '-' : r.spearman.toFixed(2)}`);
  console.log(`n: ${r.n} (scored cells ${r.scoredCells}, weekdays ${r.weekdaysCovered}/7, days ${r.days})`);
  for (const g of r.golden) {
    console.log(`golden[${'월화수목금토일'[g.weekday]}]: predicted ${g.predictedHour}시, measured ${g.measuredHour}시, rank ${g.rank} → ${g.hit ? 'hit' : 'miss'}`);
  }
  console.log(`summary: ${summaryLine(r, pattern.year)}`);
}
