import {test,expect} from '@playwright/test';
test('30-minute refresh, hidden pause, resume failure and recovery',async({page})=>{
  await page.clock.install();
  await page.addInitScript(()=>{
    const state={calls:0,mode:'ok',hidden:false};Object.assign(window,{recentTest:state});
    Object.defineProperty(document,'hidden',{get:()=>state.hidden});
    const original=window.fetch;
    window.fetch=(url,init)=>{
      if(String(url).includes('parkingorsApi'))return Promise.resolve(new Response('[{"parking_sum":1200}]'));
      if(!String(url).includes('realtime-history.json'))return original(url,init);
      state.calls++;
      if(state.mode==='hang')return new Promise<Response>(()=>{});
      if(state.mode==='fail')return Promise.reject(new Error('offline'));
      const now=Date.now();return Promise.resolve(new Response(JSON.stringify([{t:now-1800000,count:1000},{t:now-1000,count:1800+state.calls}])));
    };
  });
  const calls=()=>page.evaluate(()=> (window as unknown as {recentTest:{calls:number}}).recentTest.calls);
  const mode=async(mode:string,hidden=false)=>page.evaluate(({mode,hidden})=>{Object.assign((window as unknown as {recentTest:object}).recentTest,{mode,hidden});document.dispatchEvent(new Event('visibilitychange'));},{mode,hidden});
  await page.goto('/ksponco-goldentime/');await expect(page.getByText('최근 24시간 추이',{exact:true})).toBeVisible();
  const first=await calls();await page.clock.fastForward(1800001);await expect.poll(calls).toBeGreaterThan(first);
  const expected = (1800 + await calls()).toLocaleString('en-US');
  await expect(page.locator('.trend').first()).toContainText(`최대 ${expected}대`);
  await mode('ok',true);const hidden=await calls();await page.clock.fastForward(1800001);expect(await calls()).toBe(hidden);
  await mode('fail');await expect(page.getByRole('status').filter({hasText:'이력 갱신 실패'})).toContainText('마지막 수집');
  await expect(page.locator('.trend').first()).toBeVisible();
  await mode('hang');await page.clock.fastForward(10001);await expect(page.getByRole('status').filter({hasText:'시간이 초과'})).toBeVisible();
  await mode('ok');await expect(page.getByRole('status').filter({hasText:'이력 갱신 실패'})).toHaveCount(0);
});


test('mixed intervals keep elapsed positions and split only gaps above 45 minutes', async ({page}) => {
  const origin = Date.now() - 7 * 60 * 60 * 1000;
  await page.route('**/realtime-history.json*', route => route.fulfill({json:[0,30,75,121,360].map((minute,i)=>({t:origin+minute*60000,count:1000+i*100}))}));
  await page.route('**/*parkingorsApi*', route=>route.fulfill({json:[{parking_sum:1500}]}));
  await page.goto('/ksponco-goldentime/');
  const chart=page.locator('.trend').first();
  await expect(chart).toContainText('표시 데이터 공백 3곳');
  const lines=await chart.locator('polyline').evaluateAll(els=>els.map(el=>el.getAttribute('points')!.split(' ').map(pair=>pair.split(',').map(Number))));
  expect(lines).toHaveLength(1);
  expect(lines[0]).toHaveLength(3);
  const [a,b,c]=lines[0];
  expect((b[0]-a[0])/(c[0]-a[0])).toBeCloseTo(30/75,5);
  const marks=await chart.locator('svg circle').evaluateAll(els=>els.map(el=>Number(el.getAttribute('cx'))));
  const [afterGap,later]=marks;
  expect((afterGap-a[0])/(later-a[0])).toBeCloseTo(121/360,5);
});
