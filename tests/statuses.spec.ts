import {test,expect,type APIRequestContext} from '@playwright/test';
const uid=()=>crypto.randomUUID();
async function fixture(request:APIRequestContext) {
 const response=await request.post('/api/v1/companies',{headers:{'Idempotency-Key':uid()},data:{name:'Refusal fixture '+uid()}});
 expect(response.ok()).toBeTruthy();const company=(await response.json()).data;
 const imported=await request.post('/api/v1/vacancy-source-references',{headers:{'Idempotency-Key':uid()},data:{source_id:'20000000-0000-4000-8000-000000000001',external_vacancy_id:uid(),vacancy:{company_id:company.id,title:'Rust / LangGraph fixture '+uid()},observation:{observation_key:uid(),observed_at:new Date().toISOString()}}});
 expect(imported.ok()).toBeTruthy();return {company,id:(await imported.json()).data.vacancy_id as string};
}
test('explicit refusals persist, filter separately, round trip and show Russian history',async({page,request})=>{
 const {company,id}=await fixture(request);const url='/vacancies/'+id;
 await page.goto(url);await expect(page.getByRole('radio',{name:'Новая',exact:true})).toBeChecked();
 await expect(page.getByRole('radio',{name:'Отказ — сторона не указана',exact:true})).toHaveCount(0);
 for(const [code,label] of [['declined_by_applicant','Я отказался'],['rejected_by_employer','Работодатель отказал'],['new','Новая']] as const) {
  await page.getByRole('radio',{name:label,exact:true}).check();await page.getByLabel('Заметки',{exact:true}).fill('User text: LangGraph stays unchanged');
  await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();await expect(page.getByRole('status')).toContainText('Сохранено в SQLite.');
  await page.reload();await expect(page.getByRole('radio',{name:label,exact:true})).toBeChecked();
  expect((await (await request.get('/api/v1/vacancies/'+id)).json()).data.status).toBe(code);
  await page.goto('/vacancies?company_id='+company.id+'&status='+code);
  await expect(page.locator('.record-row')).toHaveCount(1);await expect(page.locator('.record-meta .badge')).toHaveText(label);
  await page.goto(url);
 }
 const history=page.locator('.panel').filter({has:page.getByRole('heading',{name:'История статусов',exact:true})});
 await expect(history.locator('li')).toHaveCount(3);await expect(history).toContainText('Новая → Я отказался');await expect(history).toContainText('Я отказался → Работодатель отказал');
 await expect(page.getByLabel('Заметки',{exact:true})).toHaveValue('User text: LangGraph stays unchanged');
 await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();await expect(page.getByRole('status')).toContainText('Сохранено в SQLite.');
 expect((await (await request.get('/api/v1/vacancies/'+id+'/status-history')).json()).items).toHaveLength(3);
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('radio',{name:'Работодатель отказал',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/refusals-ru-mobile.png',fullPage:true});
});
test('legacy refusal remains unspecified until explicit choice; failed save retains draft',async({page,request})=>{
 const {id}=await fixture(request);expect((await request.patch('/api/v1/vacancies/'+id,{data:{status:'rejected',notes:'Legacy English note'}})).ok()).toBeTruthy();
 await page.goto('/vacancies/'+id);await expect(page.getByRole('radio',{name:'Отказ — сторона не указана',exact:true})).toBeChecked();
 await expect(page.getByLabel('Заметки',{exact:true})).toHaveValue('Legacy English note');
 const route='**/api/v1/vacancies/'+id;
 await page.route(route,async r=>r.request().method()==='PATCH'?r.fulfill({status:422,json:{error:{code:'validation_failed',message:'Some fields are invalid.',fields:{status:['Unsupported status.']}}}}):r.continue());
 await page.getByRole('radio',{name:'Я отказался',exact:true}).check();await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Выберите допустимый статус вакансии.');await expect(page.getByRole('radio',{name:'Я отказался',exact:true})).toBeChecked();
 expect((await (await request.get('/api/v1/vacancies/'+id)).json()).data.status).toBe('rejected');
 await page.unroute(route);await page.getByRole('button',{name:'Повторить предыдущий запрос',exact:true}).click();await expect(page.getByRole('status')).toContainText('Сохранено в SQLite.');
 await page.reload();await expect(page.getByRole('radio',{name:'Я отказался',exact:true})).toBeChecked();await expect(page.getByRole('radio',{name:'Отказ — сторона не указана',exact:true})).toHaveCount(0);
 await page.goto('/vacancies?status=rejected');await page.getByRole('button',{name:/^Статусы:/}).click();await expect(page.getByRole('checkbox',{name:'Отказ — сторона не указана',exact:true})).toBeChecked();

});
