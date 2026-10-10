import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
const uid=()=>crypto.randomUUID();
async function post(request:APIRequestContext,path:string,data:unknown) {
 const response=await request.post('/api/v1/'+path,{headers:{'Idempotency-Key':uid()},data});
 expect(response.ok()).toBeTruthy();return (await response.json()).data;
}
async function ready(page:Page) {
 await page.route('**/api/v1/hh/status',route=>route.fulfill({json:{configured:true,message:'Synthetic test access only',registration_url:'https://dev.hh.ru/',terms_url:'https://dev.hh.ru/admin/developer_agreement',agreement_url:'https://hh.ru/account/agreement'}}));
}
const criteria={text:'vacancy-search-integration-test',areas:[],experience:[],work_formats:[],employment_forms:[],period_days:null,per_page:2};
function preview(config:string,page=0,hh:unknown=criteria) {
 const id=page===0?'990000000000001':'990000000000002';const time=new Date().toISOString();
 return {adapter:'hh',live:true,configuration_id:config,scanned:1,matched:1,page,per_page:2,pages:2,found:3,accessible_pages:2,next_page:page===0?1:null,skipped:0,fetched_at:time,
  notice:'Synthetic HH response used only by browser smoke.',
  candidates:[{external_vacancy_id:id,external_url:'https://hh.ru/vacancy/'+id,company_name:'Synthetic HH employer',
   vacancy:{title:'Synthetic HH QA page '+(page+1),description:'Synthetic public search snippet.',location:'Synthetic region',work_format:'remote',employment_type:'full_time',salary_min:12000000,salary_max:15000000,salary_currency:'RUB',public_url:'https://hh.ru/vacancy/'+id},
   source_payload:{provider:'hh',api_url:'https://api.hh.ru/vacancies',external_vacancy_id:id,employer_id:'990001',employer_name:'Synthetic HH employer',published_at:'2026-10-09T07:00:00.000Z',description_kind:'search_snippet',
    salary:{from:120000,to:150000,currency:'RUR',gross:true,mode:{id:'MONTH',name:'Month'},frequency:null},work_formats:['REMOTE'],employment_form:'FULL',query:hh,page,fetched_at:time}}]};
}
test('HH criteria, explicit region, manual pages and selective persistent import',async({page,request})=>{
 await ready(page);
 await page.route('**/api/v1/hh/areas?*',route=>route.fulfill({json:{items:[{id:'991',name:'Synthetic region'}]}}));
 const company=await post(request,'companies',{name:'HH UI company '+uid()});
 await page.goto('/search-configurations/new');await page.getByLabel('Название профиля').fill('HH synthetic '+uid());
 await page.getByLabel('Использовать критерии HH для этого профиля').check();
 await page.getByLabel('Запрос HH',{exact:true}).fill(criteria.text);
 await page.getByLabel('Вакансий на странице HH').fill('2');await page.getByLabel('Период публикации HH (дни, необязательно)').fill('7');
 await page.getByRole('checkbox',{name:'HH: Удалённо',exact:true}).check();
 await page.getByLabel('Поиск региона HH',{exact:true}).fill('Synthetic');await page.getByRole('button',{name:'Найти регионы HH'}).click();
 await page.getByRole('checkbox',{name:'Synthetic region',exact:true}).check();
 await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();
 await page.waitForURL(url=>url.pathname.startsWith('/search-configurations/')&&!url.pathname.endsWith('/new'));
 const config=page.url().split('/').at(-1)!;const saved=await request.get('/api/v1/search-configurations/'+config);const hh=(await saved.json()).data.criteria.hh;
 expect(hh.text).toBe(criteria.text);expect(hh.areas).toEqual([{id:'991',name:'Synthetic region'}]);expect(hh.work_formats).toEqual(['REMOTE']);
 const pages:number[]=[];
 await page.route('**/api/v1/search-configurations/'+config+'/preview?*',route=>{const n=Number(new URL(route.request().url()).searchParams.get('page')||0);pages.push(n);return route.fulfill({json:preview(config,n,hh)});});
 await expect(page.getByRole('button',{name:'Просмотреть hh.ru',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Просмотреть hh.ru',exact:true}).click();await expect(page.getByRole('heading',{name:'Synthetic HH QA page 1',exact:true})).toBeVisible();
 expect(pages).toEqual([0]);
 await page.getByLabel('Компания для импорта 990000000000001').selectOption(company.id);
 await page.getByRole('button',{name:'Импортировать выбранную вакансию'}).click();await expect(page.getByText('Импортировано в SQLite.')).toBeVisible();
 await page.getByRole('link',{name:'Открыть вакансию →',exact:true}).click();await page.waitForURL(url=>url.pathname.startsWith('/vacancies/'));
 const vacancy=page.url().split('/').at(-1)!;await page.reload();await expect(page.getByRole('heading',{name:'Synthetic HH QA page 1',exact:true})).toBeVisible();
 await page.getByText('Исходные данные HH',{exact:true}).click();await expect(page.locator('pre').filter({hasText:'search_snippet'})).toContainText('vacancy-search-integration-test');
 const history=await request.get('/api/v1/vacancies/'+vacancy+'/discoveries');expect((await history.json()).items[0].source_payload.salary.gross).toBe(true);
 await page.goto('/search-configurations/'+config);await page.getByRole('button',{name:'Просмотреть hh.ru',exact:true}).click();await expect(page.getByRole('heading',{name:'Synthetic HH QA page 1'})).toBeVisible();
 await page.getByRole('button',{name:'Следующая страница HH'}).click();await expect(page.getByRole('heading',{name:'Synthetic HH QA page 2'})).toBeVisible();expect(pages).toEqual([0,0,1]);
 await expect(page.getByRole('button',{name:'Следующая страница HH'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Предыдущая страница HH'})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/hh-preview-mobile.png',fullPage:true});
});
test('HH preview cancels stale response and surfaces cooldown without automatic retry',async({page,request})=>{
 await ready(page);
 const config=await post(request,'search-configurations',{name:'HH cancel '+uid(),criteria_version:1,criteria:{hh:criteria}});
 let count=0;let release:()=>void=()=>undefined;const slow=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/v1/search-configurations/'+config.id+'/preview?*',async route=>{
  count++;if(count===1){await slow;await route.fulfill({json:preview(config.id)}).catch(()=>undefined);}
  else if(count===2)await route.fulfill({status:429,json:{error:{code:'hh_rate_limited',message:'HH returned a rate limit.',fields:{},retry_after_seconds:17}}});
  else await route.fulfill({json:preview(config.id)});
 });
 await page.goto('/search-configurations/'+config.id);await page.getByRole('button',{name:'Просмотреть hh.ru',exact:true}).click();
 await expect(page.getByRole('button',{name:'Отменить просмотр'})).toBeVisible();await page.getByRole('button',{name:'Отменить просмотр'}).click();release();
 await expect(page.getByText('Просмотр отменён. Вакансии не импортированы.')).toBeVisible();await expect(page.getByRole('heading',{name:'Synthetic HH QA page 1'})).toHaveCount(0);
 await page.getByRole('button',{name:'Просмотреть hh.ru',exact:true}).click();await expect(page.getByRole('alert')).toContainText('частоту запросов');
 await expect(page.getByText('До следующего запроса подождите не менее 17 секунд. Автоматического повтора нет.')).toBeVisible();expect(count).toBe(2);
 await page.getByRole('button',{name:'Просмотреть hh.ru',exact:true}).click();await expect(page.getByRole('heading',{name:'Synthetic HH QA page 1'})).toBeVisible();expect(count).toBe(3);
});
test('unconfigured HH requires explicit setup while fixture remains usable',async({page,request})=>{
 const config=await post(request,'search-configurations',{name:'HH blocked '+uid(),criteria_version:1,criteria:{hh:criteria}});
 await page.goto('/search-configurations/'+config.id);
 await expect(page.getByText('Требуется настройка доступа к HH',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Просмотреть hh.ru',exact:true})).toBeDisabled();
 await expect(page.getByRole('link',{name:'Регистрация приложения HH'})).toHaveAttribute('href','https://dev.hh.ru/');
 await page.getByRole('button',{name:'Просмотреть тестовые вакансии'}).click();await expect(page.getByText('Совпало 4 из 4 тестовых вакансий.')).toBeVisible();
});
