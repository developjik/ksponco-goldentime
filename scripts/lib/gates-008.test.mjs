import { describe, expect, it } from 'vitest';
import {
  accumulate,
  buildOutput,
  classifyItem,
  emptyAgg,
  gateName,
  maskedSample,
  newCheckpoint,
  parseFields,
  parsePage,
  pendingPages,
  restoreCheckpoint,
  serializeCheckpoint,
  toRanges,
  fromRanges,
} from './gates-008.mjs';

const item = (desc, extra = '') =>
  `<TITLE>입출차</TITLE><DESCRIPTION><![CDATA[${desc}]]></DESCRIPTION>${extra}`;
// 2025-03-15 = 토요일(weekday 5)
const ENTRY = item('차량번호:12가3456,입구:동2문입구#1,입차시간:2025-03-15 10:20:30,출구:동2문출구#1,출차시간:2025-03-15 12:50:30');

describe('gateName', () => {
  it('parseFields가 쪼갠 값(접두 없음)을 받는다 — 0건 매칭 버그 회귀', () => {
    expect(parseFields('입구:동2문입구#1')['입구']).toBe('동2문입구#1');
    expect(gateName('동2문입구#1')).toBe('동2문');
    expect(gateName('남2문CMB')).toBe('남2문');
  });
  it('접두 입구: 가 붙은 원문도 받는다', () => {
    expect(gateName('입구:북2문입구#3')).toBe('북2문');
  });
  it('게이트가 아니면 null', () => {
    expect(gateName('동2문출구#1')).toBeNull();
    expect(gateName('기타')).toBeNull();
    expect(gateName(undefined)).toBeNull();
  });
});

describe('classifyItem·accumulate', () => {
  it('입차 레코드를 게이트·요일·시간·체류로 분류', () => {
    expect(classifyItem(ENTRY)).toEqual({ gate: '동2문', year: 2025, weekday: 5, hour: 10, dwell: 150 });
  });
  it('입구 없음·시각 없음·다른 연도는 사유별로 제외', () => {
    const agg = emptyAgg();
    const n = accumulate(
      agg,
      [ENTRY, item('입차시간:2025-03-15 10:00:00'), item('입구:동2문입구#1'), item('입구:남2문CMB,입차시간:2024-12-31 23:10:00')],
      2025,
    );
    expect(n).toBe(1);
    expect(agg.records).toBe(1);
    expect(agg.skipped).toEqual({ noGate: 1, noTime: 1, otherYear: 1 });
    expect(agg.gates['동2문'][5][10]).toEqual([1, 150, 1]);
  });
  it('입차시간이 없으면 ISSUED_DATE로 대체', () => {
    expect(classifyItem(item('입구:남2문CMB', '<ISSUED_DATE>2025-01-06 08:00:00</ISSUED_DATE>'))).toMatchObject({
      gate: '남2문',
      weekday: 0,
      hour: 8,
      dwell: null,
    });
  });
});

describe('parsePage', () => {
  it('resultCode·totalCount·items 추출', () => {
    const xml = `<response><header><resultCode>0000</resultCode></header><body><items><item>${ENTRY}</item><item>${ENTRY}</item></items><totalCount>2410000</totalCount></body></response>`;
    const p = parsePage(xml);
    expect(p.ok).toBe(true);
    expect(p.items).toHaveLength(2);
    expect(p.totalCount).toBe(2410000);
  });
  it('오류 코드면 ok=false', () => {
    expect(parsePage('<resultCode>9999</resultCode>').ok).toBe(false);
  });
});

describe('checkpoint', () => {
  const meta = { year: 2025, numOfRows: 2000, totalCount: 9000 };
  it('구간 압축 왕복', () => {
    expect(toRanges([5, 1, 2, 3, 7, 8])).toEqual([[1, 3], [5, 5], [7, 8]]);
    expect([...fromRanges([[1, 3], [7, 8]])]).toEqual([1, 2, 3, 7, 8]);
  });
  it('직렬화·복원 후 남은 페이지 계산', () => {
    const cp = newCheckpoint(meta);
    expect(cp.totalPages).toBe(5);
    cp.done.add(1).add(2).add(4);
    accumulate(cp.agg, [ENTRY], 2025);
    const back = restoreCheckpoint(serializeCheckpoint(cp), meta);
    expect(pendingPages(back)).toEqual([3, 5]);
    expect(back.agg.records).toBe(1);
  });
  it('수집 조건이 달라지면 복원하지 않음', () => {
    const json = serializeCheckpoint(newCheckpoint(meta));
    expect(restoreCheckpoint(json, { ...meta, totalCount: 9999 })).toBeNull();
    expect(restoreCheckpoint(json, { ...meta, numOfRows: 5000 })).toBeNull();
    expect(restoreCheckpoint('not json', meta)).toBeNull();
  });
  it('최종 산출물은 기존 GatesData 스키마', () => {
    const cp = newCheckpoint(meta);
    accumulate(cp.agg, [ENTRY, ENTRY], 2025);
    const out = buildOutput(cp, 'src');
    expect(out).toMatchObject({ year: 2025, records: 2, totalCount: 9000 });
    expect(out.gates[0]).toMatchObject({ name: '동2문', entries: 2 });
    expect(out.gates[0].weekdayHour[5][10]).toEqual({ e: 2, d: 150 });
    expect(out.gates[0].weekdayHour[0][0]).toBeNull();
  });
});

describe('maskedSample', () => {
  it('게이트·시각은 남기고 나머지 값은 가린다', () => {
    const s = maskedSample(ENTRY);
    expect(s.description['입구']).toBe('동2문입구#1');
    expect(s.description['차량번호']).toBe('<7자 가림>');
    expect(s.tags).toEqual(['TITLE', 'DESCRIPTION']);
  });
});
