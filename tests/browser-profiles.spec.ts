import {test,expect,type APIRequestContext} from '@playwright/test';
const uid=()=>crypto.randomUUID();
async function post(request:APIRequestContext,path:string,data:unknown){
 const response=await request.post('/api/v1/'+path,{headers:{'Idempotency-Key':uid()},data});
 expect(response.ok()).toBeTruthy();return (await response.json()).data;
}
test('browser profiles preserve separate queries, filtered discoveries and provenance',async({page,request})=>{
 const firstName='Browser agents '+uid();
 const second=await post(request,'search-configurations',{name:'Independent Rust '+uid(),criteria_version:1,criteria:{queries:['Rust'],work_formats:['remote']}});
 await page.goto('/search-configurations/new');
 await page.getByLabel('Название профиля').fill(firstName);
 await page.getByLabel('Запросы в браузере (по одному на строку)').fill('!agentic\nLangGraph');
 await page.getByRole('checkbox',{name:'Удалённо',exact:true}).check();
 await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();
 await page.waitForURL(url=>url.pathname.startsWith('/search-configurations/')&&!url.pathname.endsWith('/new'));
 const first=page.url().split('/').at(-1)!;
 await expect(page.getByRole('link',{name:'!agentic',exact:true})).toHaveAttribute('href','https://hh.ru/search/vacancy?text=%21agentic&work_format=REMOTE');
 await page.getByRole('link',{name:'Редактировать'}).click();
 await page.getByLabel('Запросы в браузере (по одному на строку)').fill('!agentic\nCrewAI');
 await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
 await expect(page.getByRole('link',{name:'CrewAI',exact:true})).toBeVisible();
 const unchanged=await request.get('/api/v1/search-configurations/'+second.id);
 expect((await unchanged.json()).data.criteria.queries).toEqual(['Rust']);
 const company=await post(request,'companies',{name:'Synthetic browser review '+uid()});
 const id='990000000000012',url='https://hh.ru/vacancy/'+id,time=new Date().toISOString();
 const body={source_id:'20000000-0000-4000-8000-000000000004',external_vacancy_id:id,external_url:url,
 vacancy:{company_id:company.id,title:'Synthetic browser Agent Engineer',work_format:'remote',public_url:url},
 observation:{observation_key:uid(),observed_at:time,search_configuration_id:first,
 source_payload:{provider:'hh-browser',external_vacancy_id:id,source_url:url,employer_name:company.name,published_date:'2026-10-08',queries:['!agentic'],reviewed_at:time,relevance_reason:'Synthetic agent development.',remote_evidence:'Synthetic remote-only format.',eligibility_notes:'Country unspecified.',classification:'relevant'}}};
 const imported=await post(request,'vacancy-source-references',body);
 const retry=await request.post('/api/v1/vacancy-source-references',{headers:{'Idempotency-Key':uid()},data:body});
 expect(retry.ok()).toBeTruthy();
 await page.reload();await page.getByRole('link',{name:'Связанные вакансии'}).click();
 await expect(page.getByRole('heading',{name:'Synthetic browser Agent Engineer'})).toBeVisible();
 await page.getByRole('link').filter({has:page.getByRole('heading',{name:'Synthetic browser Agent Engineer'})}).click();
 await page.getByText('Данные просмотра HH в браузере',{exact:true}).click();
 await expect(page.locator('pre').filter({hasText:'hh-browser'})).toContainText('Country unspecified.');
 await page.reload();await expect(page.getByRole('heading',{name:'Synthetic browser Agent Engineer',exact:true})).toBeVisible();
 const history=await request.get('/api/v1/vacancies/'+imported.vacancy_id+'/discoveries');
 expect((await history.json()).items).toHaveLength(1);
 await page.goto('/vacancies?search_configuration_id='+second.id);
 await expect(page.getByRole('heading',{name:'Synthetic browser Agent Engineer'})).toHaveCount(0);
});
