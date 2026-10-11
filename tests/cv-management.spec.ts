import { test,expect,type APIRequestContext } from '@playwright/test';
test.beforeEach(async({baseURL})=>{const u=new URL(baseURL!);if(u.hostname!=='127.0.0.1'||u.port==='48173')throw new Error('CV management smoke requires an isolated fixture server.');});
type CV={id:string;name:string;current_revision_id:string;current_revision_number:number;lifecycle_version:number;deleted_at:string|null;source_code:string;source_url:string|null;revision:{content:string;source:{kind:string}}};
async function post(request:APIRequestContext,path:string,data:unknown):Promise<CV> {const r=await request.post('/api/v1/'+path,{headers:{'Idempotency-Key':crypto.randomUUID()},data});expect(r.ok(),path+': '+r.status()).toBeTruthy();return (await r.json()).data;}
async function detail(request:APIRequestContext,id:string):Promise<CV> {return (await (await request.get('/api/v1/cvs/'+id)).json()).data;}
function input(source='manual') {const key=crypto.randomUUID();return {name:'Synthetic lifecycle '+key,hh_url:source==='hh.ru'?'https://hh.ru/resume/synthetic_'+key:null,source_code:source,source_url:source==='hh.ru'?'https://hh.ru/resume/synthetic_'+key:null,content:'Synthetic Rust CV. Persistent history.',structured:{skills:['Rust']},source:{kind:'manual_text',observed_at:new Date().toISOString()},confirmed:true};}
async function createCv(request:APIRequestContext,data:unknown){const c=await post(request,'cvs',data);return detail(request,c.id);}
function lifecycle(cv:CV){return {confirmed:true,expected_revision_id:cv.current_revision_id,expected_lifecycle_version:cv.lifecycle_version};}
test('delete cancel, Escape, filtered deleted view, restore and history preserve one CV',async({page,request})=>{
 const c=await createCv(request,input('hh.ru'));let writes=0;page.on('request',r=>{if(r.method()==='POST'&&/\/(delete|restore)$/.test(r.url()))writes++;});
 await page.goto('/cvs?source_code=hh.ru');
 const row=page.locator('.record-row').filter({hasText:c.name});await expect(row).toContainText('hh.ru');await expect(row).not.toContainText('https://');
 await row.click();await page.getByRole('button',{name:'Удалить CV',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Отмена',exact:true}).click();
 await page.getByRole('button',{name:'Удалить CV',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();expect(writes).toBe(0);
 await page.getByRole('button',{name:'Удалить CV',exact:true}).click();await page.getByRole('button',{name:'Подтвердить удаление',exact:true}).click();
 await expect(page.getByRole('button',{name:'Восстановить CV',exact:true})).toBeVisible();expect(writes).toBe(1);
 await expect(page.getByRole('link',{name:'Создать новую версию',exact:true})).toHaveCount(0);
 await page.getByRole('link',{name:'Версия 1 · '+c.name,exact:true}).click();await expect(page.locator('.cv-content')).toHaveText(c.revision.content);
 await page.getByRole('link',{name:'← Удалённые CV',exact:true}).click();await expect(page).toHaveURL(/deleted=true/);await expect(page).toHaveURL(/source_code=hh.ru/);await expect(page.locator('.record-row').filter({hasText:c.name})).toBeVisible();
 await page.getByRole('link',{name:'Активные CV',exact:true}).click();await expect(page.locator('.record-row').filter({hasText:c.name})).toHaveCount(0);
 await page.goBack();await expect(page.getByRole('heading',{name:'Удалённые CV',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Источник CV: hh.ru',exact:true})).toBeVisible();
 await page.locator('.record-row').filter({hasText:c.name}).click();await page.getByRole('button',{name:'Восстановить CV',exact:true}).click();await expect(page.getByRole('button',{name:'Удалить CV',exact:true})).toBeVisible();
 const restored=await detail(request,c.id);expect(restored.deleted_at).toBeNull();expect(restored.lifecycle_version).toBe(2);expect(restored.current_revision_id).toBe(c.current_revision_id);expect(restored.revision).toEqual(c.revision);
 await page.getByRole('link',{name:'← Мои CV',exact:true}).click();await expect(page).toHaveURL(/source_code=hh.ru/);await expect(page).not.toHaveURL(/deleted=true/);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBeTruthy();
});
test('lost delete response retries the same request UUID once and does not create revisions',async({page,request})=>{
 const c=await createCv(request,input());await page.goto('/cvs/'+c.id);const keys:string[]=[];let lost=false;
 // Keep the old loader snapshot until retry: this also models a stale browser cache.
 await page.route('**/api/v1/cvs/'+c.id,async route=>{if(lost&&keys.length===1)await route.fulfill({json:{data:c}});else await route.continue();});
 await page.route('**/api/v1/cvs/'+c.id+'/delete',async route=>{keys.push(route.request().headers()['idempotency-key']);if(keys.length===1){await route.fetch();lost=true;await route.abort('failed');}else await route.continue();});
 await page.getByRole('button',{name:'Удалить CV',exact:true}).click();await page.getByRole('button',{name:'Подтвердить удаление',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Соединение потеряно');
 await page.getByRole('button',{name:'Повторить предыдущий запрос',exact:true}).click();await expect(page.getByRole('button',{name:'Восстановить CV',exact:true})).toBeVisible();
 expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);const deleted=await detail(request,c.id);expect(deleted.lifecycle_version).toBe(1);expect(deleted.current_revision_id).toBe(c.current_revision_id);
});
test('stale delete after external delete and restore cannot remove restored CV',async({page,request})=>{
 const c=await createCv(request,input());await page.goto('/cvs/'+c.id);
 const removed=await post(request,'cvs/'+c.id+'/delete',lifecycle(c));await post(request,'cvs/'+c.id+'/restore',lifecycle(removed));
 await page.getByRole('button',{name:'Удалить CV',exact:true}).click();
 const response=page.waitForResponse(r=>r.url().endsWith('/cvs/'+c.id+'/delete')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Подтвердить удаление',exact:true}).click();expect((await response).status()).toBe(409);
 const restored=await detail(request,c.id);expect(restored.deleted_at).toBeNull();expect(restored.lifecycle_version).toBe(2);await page.reload();await expect(page.getByRole('button',{name:'Удалить CV',exact:true})).toBeVisible();
});
test('explicit origin import and source multiselect persist across views and browser history',async({page,request})=>{
 const name='Synthetic Skillstaff '+crypto.randomUUID();
 await page.goto('/cvs/new');await page.getByLabel('Название CV',{exact:true}).fill(name);await page.getByLabel('Источник CV',{exact:true}).selectOption('skillstaff.ru');
 const url='https://skillstaff.ru/cv/'+crypto.randomUUID();await page.getByLabel('Ссылка на CV в источнике',{exact:true}).fill(url);await page.getByLabel('Внешний ID CV (если известен)',{exact:true}).fill('synthetic');
 await page.getByLabel('Содержимое CV',{exact:true}).fill('Synthetic Rust CV from explicit source.');await page.getByRole('button',{name:'Предпросмотр CV',exact:true}).click();await expect(page.getByRole('heading',{name:'Проверьте импорт'})).toBeVisible();
 await page.getByRole('checkbox',{name:'Я проверил(а) содержимое и происхождение CV'}).check();await page.getByRole('button',{name:'Сохранить CV',exact:true}).click();await page.waitForURL(/\/cvs\/[a-f0-9-]+$/);
 const c=await detail(request,page.url().split('/').at(-1)!);expect(c.source_code).toBe('skillstaff.ru');expect(c.source_url).toBe(url);expect(c.revision.source.kind).toBe('manual_text');
 for(const source of ['jobs-a.test','jobs-b.test','jobs-c.test','jobs-d.test'])await post(request,'cvs',input(source));
 await page.goto('/cvs');await page.getByRole('button',{name:'Источник CV: Все',exact:true}).click();await page.getByLabel('Поиск источников CV',{exact:true}).fill('skill');await page.getByRole('checkbox',{name:'skillstaff.ru',exact:true}).check();await page.getByLabel('Поиск источников CV',{exact:true}).fill('hh');await page.getByRole('checkbox',{name:'hh.ru',exact:true}).check();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Применить фильтры',exact:true}).click();await expect(page.getByRole('button',{name:'Источник CV: Выбрано: 2',exact:true})).toBeVisible();await expect(page.locator('.record-row').filter({hasText:name})).toBeVisible();
 await page.getByRole('link',{name:'Удалённые CV',exact:true}).click();await expect(page).toHaveURL(/deleted=true/);await expect(page.getByRole('button',{name:'Источник CV: Выбрано: 2',exact:true})).toBeVisible();
 await page.goBack();await expect(page.getByRole('heading',{name:'Мои CV',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Источник CV: Выбрано: 2',exact:true})).toBeVisible();
 await page.goForward();await expect(page.getByRole('heading',{name:'Удалённые CV',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Источник CV: Выбрано: 2',exact:true})).toBeVisible();
});
test('deleted CV blocks a stale new batch while an existing packet keeps pinned inputs',async({page,request})=>{
 const c=await createCv(request,input());const suffix=crypto.randomUUID();
 const company=await post(request,'companies',{name:'Synthetic '+suffix});
 const ref=await post(request,'vacancy-source-references',{source_id:'20000000-0000-4000-8000-000000000001',external_vacancy_id:suffix,vacancy:{company_id:company.id,title:'Rust lifecycle '+suffix},observation:{observation_key:suffix,observed_at:new Date().toISOString()}});
 const vacancyId=(ref as unknown as {vacancy_id:string}).vacancy_id;expect((await request.patch('/api/v1/vacancies/'+vacancyId,{data:{status:'saved'}})).ok()).toBeTruthy();
 const run=await post(request,'match-runs',{cv_id:c.id,expected_revision_id:c.current_revision_id,selection:{statuses:['saved'],q:suffix},confirmed:true});
 await page.goto('/match-runs/new?cv_id='+c.id);await page.getByLabel('Поиск по названию вакансии').fill(suffix);await page.getByRole('button',{name:'Предпросмотр выборки',exact:true}).click();await expect(page.getByRole('heading',{name:'Состав пакета: 1'})).toBeVisible();
 await post(request,'cvs/'+c.id+'/delete',lifecycle(c));await page.getByRole('checkbox',{name:'Подтверждаю выбранные CV и вакансии'}).check();
 const response=page.waitForResponse(r=>r.url().endsWith('/api/v1/match-runs')&&r.request().method()==='POST');await page.getByRole('button',{name:'Создать пакет для агента',exact:true}).click();expect((await response).status()).toBe(409);
 await page.goto('/match-runs/'+run.id);await expect(page.getByText(/Этот пакет продолжает работу с сохранёнными входами/)).toBeVisible();await expect(page.getByRole('link',{name:'Создать ещё пакет',exact:true})).toHaveCount(0);
 const packet=(await (await request.get('/api/v1/match-runs/'+run.id+'/inputs')).json()).data;expect(packet.cv_revision.content).toBe(c.revision.content);
 await page.getByRole('link',{name:'Открыть версию CV',exact:true}).click();await expect(page.locator('.cv-content')).toHaveText(c.revision.content);
});
