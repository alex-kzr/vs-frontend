import {test,expect,type APIRequestContext} from '@playwright/test';

test.beforeEach(async({baseURL})=>{
 const url=new URL(baseURL!);
 if(url.hostname!=='127.0.0.1'||url.port==='48173')throw new Error('Run multi-filter tests on an isolated fixture server.');
});
async function post(request:APIRequestContext,path:string,data:unknown) {
 const response=await request.post('/api/v1/'+path,{headers:{'Idempotency-Key':crypto.randomUUID()},data});
 expect(response.ok()).toBeTruthy();return (await response.json()).data;
}
async function fixture(request:APIRequestContext) {
 const suffix=crypto.randomUUID();
 const companies=[];
 for(const name of ['Альфа','Бета','Гамма'])companies.push(await post(request,'companies',{name:'Мульти '+name+' '+suffix}));
 const profile=await post(request,'search-configurations',{name:'Мульти профиль '+suffix,criteria_version:1,criteria:{keywords:['Rust']}});
 const rows=[];
 for(const [i,status,linked] of [[0,'new',true],[0,'saved',false],[0,'declined_by_applicant',true],[1,'new',true],[1,'saved',true],[2,'saved',true]] as const) {
  const ref=await post(request,'vacancy-source-references',{source_id:'20000000-0000-4000-8000-000000000001',external_vacancy_id:crypto.randomUUID(),vacancy:{company_id:companies[i].id,title:'Filter fixture '+suffix+' '+i+' '+status},observation:{observation_key:crypto.randomUUID(),observed_at:new Date().toISOString(),...(linked?{search_configuration_id:profile.id}:{})}});
  if(status!=='new')expect((await request.patch('/api/v1/vacancies/'+ref.vacancy_id,{data:{status}})).ok()).toBeTruthy();
  rows.push(ref.vacancy_id as string);
 }
 return {companies,profile,rows,suffix};
}
test('multi filters combine selections, preserve hidden choices and paginate with URL history',async({page,request})=>{
 const {companies,profile,rows}=await fixture(request);
 const source='20000000-0000-4000-8000-000000000001';
 await page.goto('/vacancies?search_configuration_id='+profile.id+'&source_id='+source+'&limit=1');
 const statuses=page.locator('.checkbox-filter').filter({has:page.locator('input[name="status"]')});
 // Before any selection, locate by the visible caption.
 const statusFilter=page.locator('.checkbox-filter').filter({has:page.locator('.filter-caption', {hasText:'Статусы'})});
 const companyFilter=page.locator('.checkbox-filter').filter({has:page.locator('.filter-caption', {hasText:'Компании'})});
 await statusFilter.locator('summary').focus();await page.keyboard.press('Space');
 await expect(statusFilter.locator('input[type="search"]')).toHaveCount(0);
 await statusFilter.getByRole('checkbox',{name:'Новая',exact:true}).check();
 await statusFilter.getByRole('checkbox',{name:'Сохранена',exact:true}).focus();await page.keyboard.press('Space');
 await page.keyboard.press('Escape');await expect(statusFilter.locator('summary')).toBeFocused();
 await companyFilter.locator('summary').click();
 await companyFilter.getByLabel('Поиск компаний').fill('АЛЬФА');
 await companyFilter.getByRole('checkbox',{name:companies[0].name,exact:true}).check();
 await companyFilter.getByLabel('Поиск компаний').fill('nothing-matches');
 await expect(companyFilter.getByText('Ничего не найдено. Измените поиск.')).toBeVisible();
 await companyFilter.locator('summary').click();await companyFilter.locator('summary').click();
 await companyFilter.getByLabel('Поиск компаний').fill('бета');
 await companyFilter.getByRole('checkbox',{name:companies[1].name,exact:true}).check();
 await companyFilter.getByLabel('Поиск компаний').fill('');
 await expect(companyFilter.getByRole('checkbox',{name:companies[0].name,exact:true})).toBeChecked();
 await companyFilter.locator('summary').click();
 await page.getByRole('button',{name:'Применить фильтры',exact:true}).click();
 await expect(page).toHaveURL(/status=new&status=saved/);
 await expect(page.locator('.record-row')).toHaveCount(1);
 const url=new URL(page.url());
 expect(url.searchParams.getAll('status').sort()).toEqual(['new','saved']);
 expect(url.searchParams.getAll('company_id').sort()).toEqual([companies[0].id,companies[1].id].sort());
 expect(url.searchParams.get('search_configuration_id')).toBe(profile.id);
 expect(url.searchParams.get('source_id')).toBe(source);expect(url.searchParams.get('limit')).toBe('1');
 const seen=new Set<string>();
 seen.add((await page.locator('.record-row').getAttribute('href'))!);
 const first=page.url();
 await page.getByRole('link',{name:'Следующая страница'}).click();await expect(page).not.toHaveURL(first);
 const second=page.url();seen.add((await page.locator('.record-row').getAttribute('href'))!);
 await page.getByRole('link',{name:'Следующая страница'}).click();await expect(page).not.toHaveURL(second);
 seen.add((await page.locator('.record-row').getAttribute('href'))!);
 await expect(page.getByRole('link',{name:'Следующая страница'})).toHaveCount(0);
 expect(seen).toEqual(new Set([rows[0],rows[3],rows[4]].map(id=>'/vacancies/'+id)));
 await page.goBack();await expect(page).toHaveURL(second);
 await statusFilter.locator('summary').click();
 await expect(statusFilter.getByRole('checkbox',{name:'Новая',exact:true})).toBeChecked();
 await expect(statusFilter.getByRole('checkbox',{name:'Сохранена',exact:true})).toBeChecked();
 await companyFilter.locator('summary').click();
 await expect(companyFilter.getByRole('checkbox',{name:companies[0].name,exact:true})).toBeChecked();
 await expect(companyFilter.getByRole('checkbox',{name:companies[1].name,exact:true})).toBeChecked();
 await page.goForward();await expect(page.getByRole('link',{name:'Следующая страница'})).toHaveCount(0);
 await expect(statuses.locator('summary')).toContainText('Выбрано: 2');
 await page.reload();await expect(companyFilter.locator('summary')).toContainText('Выбрано: 2');
});
test('clearing selections and empty search recover without modifying vacancy records',async({page,request})=>{
 const {companies,rows,suffix}=await fixture(request);
 const records=await Promise.all(rows.map(async id=>(await (await request.get('/api/v1/vacancies/'+id)).json()).data));
 await page.goto('/vacancies?company_id='+companies[0].id+'&company_id='+companies[1].id+'&status=new&status=saved&q=impossible-'+suffix);
 await expect(page.getByRole('heading',{name:'Совпадений нет',exact:true})).toBeVisible();
 const statusFilter=page.locator('.checkbox-filter').filter({has:page.locator('.filter-caption',{hasText:'Статусы'})});
 const companyFilter=page.locator('.checkbox-filter').filter({has:page.locator('.filter-caption',{hasText:'Компании'})});
 await statusFilter.locator('summary').click();await statusFilter.getByRole('button',{name:'Очистить выбор'}).click();
 await expect(statusFilter.getByRole('checkbox',{checked:true})).toHaveCount(0);
 await statusFilter.locator('summary').click();
 await page.getByLabel('Поиск',{exact:true}).fill('');
 await page.getByRole('button',{name:'Применить фильтры',exact:true}).click();
 await expect(page.locator('.record-row')).toHaveCount(5);
 expect(new URL(page.url()).searchParams.has('status')).toBeFalsy();
 await companyFilter.locator('summary').click();
 await companyFilter.getByLabel('Поиск компаний').fill('nothing-matches');
 await companyFilter.getByRole('button',{name:'Очистить выбор'}).click();
 await companyFilter.getByLabel('Поиск компаний').fill('');
 await expect(companyFilter.getByRole('checkbox',{checked:true})).toHaveCount(0);
 await companyFilter.locator('summary').click();await companyFilter.locator('summary').click();
 await expect(companyFilter.getByRole('checkbox',{checked:true})).toHaveCount(0);
 await companyFilter.locator('summary').click();
 await page.getByRole('button',{name:'Применить фильтры',exact:true}).click();
 await expect(page).toHaveURL(/\/vacancies$/);
 await page.goto('/vacancies?company_id='+companies[0].id+'&status=saved');
 await page.getByRole('link',{name:'Сбросить',exact:true}).click();
 await expect(page).toHaveURL(/\/vacancies$/);
 const after=await Promise.all(rows.map(async id=>(await (await request.get('/api/v1/vacancies/'+id)).json()).data));
 expect(after).toEqual(records);
 await page.setViewportSize({width:390,height:844});
 await companyFilter.locator('summary').click();await companyFilter.getByLabel('Поиск компаний').fill('Альфа');
 await expect(companyFilter.getByRole('checkbox',{name:companies[0].name,exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:'test-results/multi-filters-mobile.png',fullPage:true});
});
