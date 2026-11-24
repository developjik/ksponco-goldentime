import {test,expect} from '@playwright/test';
test('timeout unlocks manual and automatic refresh; leaving cancels the request',async({page})=>{
  await page.clock.install();
  await page.addInitScript(()=>{
    const state={mode:'hang',calls:0,signals:[] as AbortSignal[]};
    Object.assign(window,{parkingTest:state});
    const original=window.fetch;
    window.fetch=(url,init)=>{
      if(!String(url).includes('parkingorsApi'))return original(url,init);
      state.calls++;state.signals.push(init!.signal as AbortSignal);
      return state.mode==='hang' ? new Promise<Response>(()=>{}) : Promise.resolve(new Response('[{"parking_sum":1250}]'));
    };
  });
  const state=()=>page.evaluate(()=> (window as unknown as {parkingTest:{calls:number}}).parkingTest.calls);
  await page.goto('/ksponco-goldentime/');
  await expect.poll(state).toBeGreaterThan(0);
  await page.clock.fastForward(10001);
  await expect(page.getByRole('button',{name:'다시 시도'})).toBeVisible();
  await page.evaluate(()=>Object.assign((window as unknown as {parkingTest:object}).parkingTest,{mode:'ok'}));
  await page.getByRole('button',{name:'다시 시도'}).click();
  await expect(page.getByRole('meter')).toContainText('1,250');
  await page.evaluate(()=>Object.assign((window as unknown as {parkingTest:object}).parkingTest,{mode:'hang'}));
  await page.getByRole('button',{name:'새로고침'}).click();
  await page.clock.fastForward(10001);
  await expect(page.getByRole('status').filter({hasText:'마지막 성공'})).toBeVisible();
  await expect(page.getByRole('button',{name:'새로고침'})).toBeEnabled();
  await page.evaluate(()=>Object.assign((window as unknown as {parkingTest:object}).parkingTest,{mode:'ok'}));
  await page.clock.fastForward(60001);
  await expect(page.getByRole('status').filter({hasText:'마지막 성공'})).toHaveCount(0);
  await page.evaluate(()=>Object.assign((window as unknown as {parkingTest:object}).parkingTest,{mode:'hang'}));
  await page.getByRole('button',{name:'새로고침'}).click();
  await page.getByRole('link',{name:'예측',exact:true}).click();
  expect(await page.evaluate(()=> (window as unknown as {parkingTest:{signals:AbortSignal[]}}).parkingTest.signals.at(-1)!.aborted)).toBe(true);
});
