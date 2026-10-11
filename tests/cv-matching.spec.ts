import { test,expect,type APIRequestContext,type Page } from '@playwright/test';
test.beforeEach(async({baseURL})=>{const u=new URL(baseURL!);if(u.hostname!=='127.0.0.1'||u.port==='48173')throw new Error('CV smoke requires an isolated fixture server.');});
async function post(request:APIRequestContext,path:string,data:unknown) {const r=await request.post('/api/v1/'+path,{headers:{'Idempotency-Key':crypto.randomUUID()},data});expect(r.ok(),path+': '+r.status()).toBeTruthy();return (await r.json()).data;}
function cv(name:string) {return {name,hh_url:null,content:'Rust. Production APIs and SQL.',structured:{skills:['Rust','SQL']},source:{kind:'manual_text',observed_at:new Date().toISOString()},confirmed:true};}
async function fixtures(request:APIRequestContext) {
 const suffix=crypto.randomUUID();const c=await post(request,'cvs',cv('Synthetic '+suffix));const company=await post(request,'companies',{name:'Synthetic Matching '+suffix});const ids:string[]=[];
 for(const status of ['saved','saved','new']) {
  const ref=await post(request,'vacancy-source-references',{source_id:'20000000-0000-4000-8000-000000000001',external_vacancy_id:crypto.randomUUID(),vacancy:{company_id:company.id,title:'Rust fixture '+suffix},observation:{observation_key:crypto.randomUUID(),observed_at:new Date().toISOString()}});
  if(status==='saved')expect((await request.patch('/api/v1/vacancies/'+ref.vacancy_id,{data:{status,notes:'Synthetic private note'}})).ok()).toBeTruthy();ids.push(ref.vacancy_id);
 }
 return {c,suffix,ids};
}
async function createRun(page:Page,c:{id:string},suffix:string) {
 await page.goto('/match-runs/new');await page.getByLabel('CV для сопоставления').selectOption(c.id);await page.getByLabel('Поиск по названию вакансии').fill(suffix);
 await page.getByRole('button',{name:'Предпросмотр выборки',exact:true}).click();await expect(page.getByRole('heading',{name:'Состав пакета: 2'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Создать пакет для агента',exact:true})).toBeDisabled();
 await page.getByRole('checkbox',{name:'Подтверждаю выбранные CV и вакансии'}).check();await page.getByRole('button',{name:'Создать пакет для агента',exact:true}).click();
 await page.waitForURL(/\/match-runs\/[a-f0-9-]+$/);return page.url().split('/').at(-1)!;
}
function callback(run:{cv_revision_id:string},job:{attempt_id:string}){return {attempt_id:job.attempt_id,cv_revision_id:run.cv_revision_id};}
function result() {return {summary:'Synthetic transport verification.',matches:[{dimension:'skills',statement:'Rust appears in both pinned inputs.',evidence:[{source:'cv',path:'/content',quote:'Rust'},{source:'vacancy',path:'/title',quote:'Rust'}]}],gaps:[],questions:[{dimension:'experience',statement:'Ask about API scale.',evidence:[]}],unknowns:[{dimension:'language',statement:'Language requirements are not provided.',evidence:[]}]};}
async function packet(request:APIRequestContext,runId:string){return (await (await request.get('/api/v1/match-runs/'+runId+'/inputs')).json()).data;}
test('UTF-8 file preview, confirmation, CV revisions and lost response never auto-start matching',async({page,request})=>{
 const baseline=(await (await request.get('/api/v1/match-runs')).json()).items.length;
 const suffix=crypto.randomUUID();const name='File CV '+suffix;const content='Rust. Synthetic file CV.\nSQL APIs.';
 await page.goto('/cvs/new');await page.getByLabel('Название CV',{exact:true}).fill(name);
 await page.getByLabel('Файл CV (.txt / .md)').setInputFiles({name:'synthetic.md',mimeType:'text/markdown',buffer:Buffer.from(content)});
 await expect(page.getByLabel('Содержимое CV',{exact:true})).toHaveValue(content);
 await page.getByRole('button',{name:'Предпросмотр CV',exact:true}).click();await expect(page.getByRole('heading',{name:'Проверьте импорт'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Сохранить CV',exact:true})).toBeDisabled();
 await page.getByRole('checkbox',{name:'Я проверил(а) содержимое и происхождение CV'}).check();
 let key:string|null=null;await page.route('**/api/v1/cvs',async route=>{if(route.request().method()==='POST'&&!key){key=route.request().headers()['idempotency-key'];await route.fetch();await route.abort('failed');}else await route.continue();});
 await page.getByRole('button',{name:'Сохранить CV',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Соединение потеряно');
 await expect(page.getByLabel('Содержимое CV',{exact:true})).toHaveValue(content);await page.unroute('**/api/v1/cvs');
 await page.getByRole('button',{name:'Повторить предыдущий запрос',exact:true}).click();await page.waitForURL(/\/cvs\/[a-f0-9-]+$/);
 const id=page.url().split('/').at(-1)!;await expect(page.getByText('synthetic.md',{exact:true})).toBeVisible();await expect(page.locator('.cv-content')).toHaveText(content);
 const detail=(await (await request.get('/api/v1/cvs/'+id)).json()).data;expect(detail.revision.source.kind).toBe('manual_file');
 await page.getByRole('link',{name:'Создать новую версию',exact:true}).click();await page.getByLabel('Содержимое CV',{exact:true}).fill('Rust. Revised synthetic CV.');
 await page.getByRole('button',{name:'Предпросмотр CV',exact:true}).click();await page.getByRole('checkbox',{name:'Я проверил(а) содержимое и происхождение CV'}).check();await page.getByRole('button',{name:'Сохранить новую версию',exact:true}).click();
 await page.waitForURL('/cvs/'+id);await expect(page.getByRole('heading',{name:'Содержимое CV · версия 2'})).toBeVisible();
 await page.getByRole('link',{name:'Версия 1 · '+name,exact:true}).click();await expect(page.locator('.cv-content')).toHaveText(content);
 expect((await (await request.get('/api/v1/match-runs')).json()).items.length).toBe(baseline);
 expect((await (await request.get('/api/v1/cvs')).json()).items.filter((v:{name:string})=>v.name===name)).toHaveLength(1);
});
test('explicit saved batch, synthetic results, partial retry, pinned evidence and staleness',async({page,request})=>{
 const {c,suffix,ids}=await fixtures(request);const runId=await createRun(page,c,suffix);let p=await packet(request,runId);
 expect(p.jobs).toHaveLength(2);expect(p.jobs[0].snapshot.notes).toBeUndefined();expect(p.jobs[0].snapshot.status).toBeUndefined();
 const [first,second]=p.jobs;const path=(job:{id:string})=>'match-runs/'+runId+'/jobs/'+job.id;
 for(const job of p.jobs)await post(request,path(job)+'/claim',{...callback(p.run,job),agent:'synthetic-smoke'});
 await post(request,path(first)+'/complete',{...callback(p.run,first),engine:{kind:'synthetic',agent:'synthetic-smoke'},assessment:result()});
 await post(request,path(second)+'/fail',{...callback(p.run,second),error:{code:'synthetic_timeout',message:'Synthetic partial failure'}});
 await page.reload();await expect(page.getByText(/Частичный результат/)).toBeVisible();await page.getByRole('button',{name:'Вернуть в очередь',exact:true}).click();
 await expect(page.getByText('В очереди',{exact:true})).toBeVisible();p=await packet(request,runId);const retried=p.jobs.find((j:{id:string})=>j.id===second.id);
 expect(retried.attempt_number).toBe(2);await post(request,path(retried)+'/claim',{...callback(p.run,retried),agent:'synthetic-smoke'});await post(request,path(retried)+'/complete',{...callback(p.run,retried),engine:{kind:'synthetic',agent:'synthetic-smoke'},assessment:result()});
 await page.reload();await expect(page.getByText(/Завершено 2 из 2/)).toBeVisible();await page.getByRole('link',{name:'Rust fixture '+suffix,exact:true}).first().click();
 await expect(page.getByText('Синтетический тестовый результат. Реальный LLM-анализ не выполнялся.',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Совпадения',exact:true})).toBeVisible();await expect(page.locator('.evidence')).toHaveCount(2);await expect(page.getByRole('heading',{name:'Недостаточно данных',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/cv-matching-synthetic.png',fullPage:true});
 const updated={...cv(c.name),content:'New Rust CV. Explicit edit.',source:{kind:'manual_edit',observed_at:new Date().toISOString()},expected_revision_id:c.current_revision_id};
 await post(request,'cvs/'+c.id+'/revisions',updated);await page.goto('/match-runs/'+runId);await expect(page.getByText(/есть новая версия CV/)).toBeVisible();
 p=await packet(request,runId);expect(p.cv_revision.content).toBe(cv(c.name).content);
 for(const id of ids.slice(0,2))expect((await (await request.get('/api/v1/vacancies/'+id)).json()).data.status).toBe('saved');
});
test('cancel revokes pending and running jobs and rejects late callback',async({page,request})=>{
 const {c,suffix}=await fixtures(request);const runId=await createRun(page,c,suffix);const p=await packet(request,runId);const job=p.jobs[0];
 await post(request,'match-runs/'+runId+'/jobs/'+job.id+'/claim',{...callback(p.run,job),agent:'synthetic-smoke'});await page.reload();
 await page.getByRole('button',{name:'Отменить пакет',exact:true}).click();await expect(page.getByText(/Незавершённые задания будут отменены/)).toBeVisible();await page.getByRole('button',{name:'Подтвердить: Отменить пакет',exact:true}).click();
 await expect(page.getByText(/отменено 2/)).toBeVisible();
 const late=await request.post('/api/v1/match-runs/'+runId+'/jobs/'+job.id+'/complete',{headers:{'Idempotency-Key':crypto.randomUUID()},data:{...callback(p.run,job),engine:{kind:'synthetic',agent:'synthetic-smoke'},assessment:result()}});
 expect(late.status()).toBe(409);expect((await packet(request,runId)).jobs.every((j:{state:string})=>j.state==='cancelled')).toBeTruthy();
});
test('CV draft cancel and server validation keep input reviewable',async({page})=>{
 await page.goto('/cvs/new');await page.getByLabel('Название CV',{exact:true}).fill('Unsaved synthetic CV');await page.getByLabel('Содержимое CV',{exact:true}).fill('Rust');
 await page.getByRole('link',{name:'Отмена',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Продолжить редактирование'}).click();
 await page.getByLabel('Ссылка на резюме HH').fill('https://example.com/resume/fake');await page.getByRole('button',{name:'Предпросмотр CV',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Некоторые поля');
 await expect(page.getByLabel('Содержимое CV',{exact:true})).toHaveValue('Rust');
 await page.getByRole('link',{name:'Отмена',exact:true}).click();await page.getByRole('button',{name:'Отменить изменения',exact:true}).click();await page.waitForURL('/cvs');
});
