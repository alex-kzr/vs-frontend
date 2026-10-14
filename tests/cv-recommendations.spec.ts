import { test, expect, type APIRequestContext } from '@playwright/test';
test.beforeEach(async({baseURL})=>{const u=new URL(baseURL!);if(u.hostname!=='127.0.0.1'||u.port==='48173')throw new Error('Review smoke requires an isolated synthetic fixture server.');});
async function post(request:APIRequestContext,path:string,data:unknown) {const r=await request.post('/api/v1/'+path,{headers:{'Idempotency-Key':crypto.randomUUID()},data});expect(r.ok(),path+': '+r.status()).toBeTruthy();return (await r.json()).data;}
function draft(name:string){return {name,content:'Synthetic CV. Rust APIs. SQL.',structured:{},source:{kind:'manual_text',observed_at:new Date().toISOString()},confirmed:true};}
async function inputs(request:APIRequestContext,id:string){return (await (await request.get('/api/v1/cv-review-runs/'+id+'/inputs')).json()).data;}
async function claim(request:APIRequestContext,id:string){const p=await inputs(request,id);return post(request,'cv-review-runs/'+id+'/claim',{expected_version:p.run.version,agent:'synthetic-ui'});}
function finding(revision:string){return {issue_key:'describe-api-work',field:'experience',category:'clarification',mismatch:'Уточнить задачи по API',suggested_edit:'Если это соответствует опыту, описать задачи по API.',rationale:'Есть упоминание API, но не задач.',evidence:[{revision_id:revision,quote:'Rust APIs'}]};}
async function complete(request:APIRequestContext,run:{id:string;version:number;attempt_id:string},findings:unknown[],resolutions:unknown[]=[],vacancy_assessments:unknown[]=[]){return post(request,'cv-review-runs/'+run.id+'/complete',{expected_version:run.version,attempt_id:run.attempt_id,provenance:{agent:'synthetic-ui',method:'manual-review'},findings,resolutions,vacancy_assessments});}
test('explicit review retries lost creation, keeps user decisions and needs fresh review after import',async({page,request})=>{
 const c=await post(request,'cvs',draft('Synthetic UI review '+crypto.randomUUID()));await page.goto('/cvs/'+c.id);
 await expect(page.getByRole('heading',{name:'Рекомендации по CV',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Создать проверку для агента',exact:true})).toBeDisabled();
 await page.getByRole('checkbox',{name:'Подтверждаю проверку выбранных CV и входов'}).check();
 let lost=false;await page.route('**/api/v1/cv-review-runs',async route=>{if(route.request().method()==='POST'&&!lost){lost=true;await route.fetch();await route.abort('failed');}else await route.continue();});
 await page.getByRole('button',{name:'Создать проверку для агента',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Соединение потеряно');
 await page.unroute('**/api/v1/cv-review-runs');await page.getByRole('button',{name:'Повторить предыдущий запрос',exact:true}).click();await page.waitForURL(/\/cv-reviews\/[a-f0-9-]+$/);
 const id=page.url().split('/').at(-1)!;const runs=(await (await request.get('/api/v1/cvs/'+c.id+'/reviews')).json()).items;expect(runs).toHaveLength(1);
 const run=await claim(request,id);await complete(request,run,[finding(c.current_revision_id)]);
 await page.goto('/cvs/'+c.id);const rec=page.locator('article.source').filter({has:page.getByRole('heading',{name:'Уточнить задачи по API',exact:true})});
 await rec.getByLabel('Причина решения (необязательно)').fill('Такое уточнение не нужно');await rec.getByRole('button',{name:'Отклонить рекомендацию',exact:true}).click();await expect(rec).toContainText('Отклонено пользователем');
 const second=await post(request,'cv-review-runs',{cv_id:c.id,expected_revision_id:c.current_revision_id,confirmed:true});const claimed=await claim(request,second.id);await complete(request,claimed,[finding(c.current_revision_id)]);
 await page.reload();await expect(rec).toContainText('Отклонено пользователем');await expect(rec).toContainText('Такое уточнение не нужно');
 await rec.getByRole('button',{name:'Вернуть замечание в активные',exact:true}).click();await expect(rec).toContainText('Актуальное замечание');
 const next=await post(request,'cvs/'+c.id+'/revisions',{...draft(c.name),content:'Synthetic CV. Rust APIs with documented tasks. SQL.',expected_revision_id:c.current_revision_id});
 await page.reload();await expect(rec).toContainText('Нужно повторить проверку');await expect(rec).toContainText('Актуальное замечание');
 const fresh=await post(request,'cv-review-runs',{cv_id:c.id,expected_revision_id:next.current_revision_id,confirmed:true});const freshClaim=await claim(request,fresh.id);
 await complete(request,freshClaim,[],[{issue_key:'describe-api-work',rationale:'Проверено новое описание задач.',evidence:[{revision_id:next.current_revision_id,quote:'Rust APIs with documented tasks'}]}]);
 await page.reload();await expect(rec).toContainText('Устранено повторной проверкой');
 await rec.getByRole('link',{name:'История замечания',exact:true}).click();await expect(page.getByRole('heading',{name:'История рекомендации',exact:true})).toBeVisible();await expect(page.getByText('Отклонено пользователем',{exact:false}).first()).toBeVisible();
});
test('directional comparison uses pinned CVs; failed work retries and cancels without accepting a late result',async({page,request})=>{
 const a=await post(request,'cvs',draft('Synthetic compare A '+crypto.randomUUID()));const b=await post(request,'cvs',draft('Synthetic compare B '+crypto.randomUUID()));
 await page.goto('/cvs/'+a.id);await page.getByLabel('Тип проверки',{exact:true}).selectOption('cv');await page.getByLabel('CV для сравнения',{exact:true}).selectOption(b.id);
 await page.getByRole('checkbox',{name:'Подтверждаю проверку выбранных CV и входов'}).check();await page.getByRole('button',{name:'Создать проверку для агента',exact:true}).click();await page.waitForURL(/\/cv-reviews\/[a-f0-9-]+$/);
 const id=page.url().split('/').at(-1)!;const p=await inputs(request,id);expect(p.run.cv_id).toBe(a.id);expect(p.run.reference_cv_id).toBe(b.id);expect(p.reference_revision.id).toBe(b.current_revision_id);
 const run=await claim(request,id);await post(request,'cv-review-runs/'+id+'/fail',{expected_version:run.version,attempt_id:run.attempt_id,error:'Тестовая ошибка проверки'});
 await page.reload();await expect(page.getByText('Тестовая ошибка проверки',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Повторить проверку с теми же входами',exact:true}).click();await expect(page.getByText(/Ожидает агента · попытка/)).toBeVisible();
 const retry=await claim(request,id);await page.reload();await page.getByRole('button',{name:'Отменить проверку',exact:true}).click();await expect(page.getByText(/Проверка отменена · попытка/)).toBeVisible();
 const late=await request.post('/api/v1/cv-review-runs/'+id+'/complete',{headers:{'Idempotency-Key':crypto.randomUUID()},data:{expected_version:retry.version,attempt_id:retry.attempt_id,provenance:{agent:'synthetic-ui',method:'manual-review'},findings:[],resolutions:[]}});expect(late.status()).toBe(409);
 await page.reload();await expect(page.getByText(/Проверка отменена · попытка/)).toBeVisible();
});
test('saved vacancy package covers every input and displays consolidated gap evidence',async({page,request})=>{
 const c=await post(request,'cvs',draft('Synthetic gaps '+crypto.randomUUID()));const company=await post(request,'companies',{name:'Synthetic gap company '+crypto.randomUUID()});const ids:string[]=[];
 for(const suffix of ['A','B']) {
  const key=crypto.randomUUID();const ref=await post(request,'vacancy-source-references',{source_id:'20000000-0000-4000-8000-000000000001',external_vacancy_id:key,vacancy:{company_id:company.id,title:'Synthetic deployment '+suffix,description:'Required: Kubernetes deployment.'},observation:{observation_key:key,observed_at:new Date().toISOString()}});
  expect((await request.patch('/api/v1/vacancies/'+ref.vacancy_id,{data:{status:'saved'}})).ok()).toBeTruthy();ids.push(ref.vacancy_id);
 }
 await page.goto('/cvs/'+c.id);await page.getByLabel('Тип проверки',{exact:true}).selectOption('vacancies');await page.getByRole('checkbox',{name:'Подтверждаю проверку выбранных CV и входов'}).check();await page.getByRole('button',{name:'Создать проверку для агента',exact:true}).click();await page.waitForURL(/\/cv-reviews\/[a-f0-9-]+$/);
 const id=page.url().split('/').at(-1)!;const packet=await inputs(request,id);expect(packet.vacancies.length).toBeGreaterThanOrEqual(2);
 const run=await claim(request,id);const f={...finding(c.current_revision_id),issue_key:'deployment-not-confirmed',category:'unconfirmed_requirement',mismatch:'Опыт Kubernetes не подтверждён',evidence:[{revision_id:c.current_revision_id,quote:'Rust APIs'},...packet.vacancies.filter((v:{vacancy_id:string})=>ids.includes(v.vacancy_id)).map((v:{vacancy_id:string;version:string})=>({vacancy_id:v.vacancy_id,vacancy_version:v.version,quote:'Kubernetes deployment'}))]};
 const assessments=packet.vacancies.map((v:{vacancy_id:string;version:string})=>({vacancy_id:v.vacancy_id,vacancy_version:v.version,relevance:'unknown',summary:'Синтетическая оценка охвата',issue_keys:ids.includes(v.vacancy_id)?[f.issue_key]:[]}));
 await complete(request,run,[f],[],assessments);await page.reload();await expect(page.getByRole('heading',{name:'Оценки всех вакансий',exact:true})).toBeVisible();
 await page.goto('/cvs/'+c.id);await expect(page.getByText('Это требование встречалось в 2 вакансиях',{exact:true})).toBeVisible();
 await page.getByText('Это требование встречалось в 2 вакансиях',{exact:true}).click();await expect(page.getByRole('heading',{name:'Опыт Kubernetes не подтверждён',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Вакансия',exact:true})).toHaveCount(4);
});
