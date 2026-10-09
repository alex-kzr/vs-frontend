import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
const uid=()=>crypto.randomUUID();
async function post(request:APIRequestContext,path:string,data:unknown) {
 const response=await request.post('/api/v1/'+path,{headers:{'Idempotency-Key':uid()},data});
 expect(response.ok()).toBeTruthy();return (await response.json()).data;
}
async function createCompany(page:Page,name:string) {
 await page.goto('/companies/new');await page.getByLabel('Company name',{exact:true}).fill(name);await page.getByRole('button',{name:'Save record',exact:true}).click();
 await page.waitForURL(/\/companies\/[a-f0-9-]+$/);return page.url().split('/').at(-1)!;
}
test('complete search, discovery, contact, conversation and status workflow',async({page,request})=>{
 const company=await createCompany(page,'Smoke Company '+uid());
 await page.goto('/contacts/new');await page.getByLabel('Company',{exact:true}).selectOption(company);await page.getByLabel('Contact name').fill('Example Recruiter');
 await page.getByRole('checkbox',{name:'Recruiter',exact:true}).check();await page.getByRole('button',{name:'Save record',exact:true}).click();await page.waitForURL(/\/contacts\/[a-f0-9-]+$/);
 await expect(page.getByText('Recruiter',{exact:true})).toBeVisible();
 await page.goto('/search-configurations/new');await page.getByLabel('Configuration name').fill('Rust Remote '+uid());await page.getByLabel('keywords (comma separated)',{exact:true}).fill('Rust');
 await page.getByLabel('excluded keywords (comma separated)').fill('unpaid');await page.getByRole('checkbox',{name:'remote',exact:true}).check();await page.getByRole('button',{name:'Save record',exact:true}).click();
 await page.waitForURL(/\/search-configurations\/[a-f0-9-]+$/);const config=page.url().split('/').at(-1)!;
 await page.getByRole('button',{name:'Preview fixture search'}).click();await expect(page.getByText('1 of 4 fixture vacancies match.')).toBeVisible();
 await page.getByLabel('Import company for fixture-rust-remote').selectOption(company);await page.getByRole('button',{name:'Import selected candidate'}).click();
 await expect(page.getByText('Imported to SQLite.')).toBeVisible();await page.getByRole('link',{name:'Open vacancy'}).click();await page.waitForURL(url=>url.pathname.startsWith('/vacancies/') && url.pathname!=='/vacancies/new');
 await expect(page.getByRole('heading',{name:'Rust Backend Engineer',exact:true})).toBeVisible();
 const vacancy=page.url().split('/').at(-1)!;
 await page.getByLabel('Status',{exact:true}).selectOption('saved');await page.getByLabel('Notes',{exact:true}).fill('Ask about hours');await page.getByRole('button',{name:'Save changes'}).click();
 await expect(page.getByRole('status')).toContainText('Saved to SQLite.');await page.reload();await expect(page.getByLabel('Notes',{exact:true})).toHaveValue('Ask about hours');
 await page.goto('/vacancies?status=saved&q=Rust&search_configuration_id='+config);await expect(page.getByRole('heading',{name:'Rust Backend Engineer'})).toBeVisible();
 await page.screenshot({path:'test-results/vacancies-desktop.png',fullPage:true});
 await page.goto('/conversations/new');await page.getByLabel('Company',{exact:true}).selectOption(company);await page.getByLabel('Subject').fill('Interview');
 await page.getByLabel('Related vacancy').selectOption(vacancy);await page.getByLabel('Other participant').selectOption('contact');await page.getByLabel('Contact',{exact:true}).selectOption({label:'Example Recruiter'});
 await page.getByRole('button',{name:'Save record',exact:true}).click();await page.waitForURL(/\/conversations\/[a-f0-9-]+$/);
 await page.getByLabel('Message text').fill('Thanks for the interview.');await page.getByRole('button',{name:'Record message',exact:true}).click();await expect(page.getByText('Message saved to SQLite.')).toBeVisible();
 await page.getByRole('button',{name:'Record another message'}).click();await page.getByLabel('Direction').selectOption('inbound');await page.getByLabel('Message text').fill('You are welcome.');
 await page.getByRole('button',{name:'Record message',exact:true}).click();await expect(page.getByText('Message saved to SQLite.')).toBeVisible();await page.reload();
 await expect(page.locator('.timeline .message')).toHaveCount(2);await expect(page.getByText('You are welcome.',{exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/conversation-mobile.png',fullPage:true});
 const records=await request.get('/api/v1/vacancies/'+vacancy+'/discoveries');expect((await records.json()).items).toHaveLength(1);
});
test('lost response retries the same message without duplicates and retains draft',async({page,request})=>{
 const company=await post(request,'companies',{name:'Retry Company '+uid()});
 const conv=await post(request,'conversations',{company_id:company.id,channel_id:'a0000000-0000-4000-8000-000000000001',participants:[{participant_key:'self',participant_kind:'user'},{participant_key:'other',participant_kind:'unknown',display_name:'Recruiter'}]});
 const path='**/api/v1/conversations/'+conv.id+'/messages';
 await page.goto('/conversations/'+conv.id);let intercepted=false;
 await page.route(path,async route=>{if(route.request().method()==='POST'&&!intercepted){intercepted=true;await route.fetch();await route.abort('failed');}else await route.continue();});
 await page.getByLabel('Message text').fill('Record once despite lost response');await page.getByRole('button',{name:'Record message',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Connection lost');await expect(page.getByLabel('Message text')).toHaveValue('Record once despite lost response');
 await page.unroute(path);await page.getByRole('button',{name:'Retry previous submission'}).click();await expect(page.getByText('Message saved to SQLite.')).toBeVisible();
 await page.reload();await expect(page.locator('.timeline .message')).toHaveCount(1);
});
test('cancel protects dirty draft, validation conflict retains fields, and 404 is explicit',async({page,request})=>{
 await page.goto('/companies/new');await page.getByLabel('Company name',{exact:true}).fill('Unsaved');
 await page.getByRole('link',{name:'Cancel',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Keep editing'}).click();await expect(page.getByLabel('Company name',{exact:true})).toHaveValue('Unsaved');
 await page.getByRole('link',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard draft'}).click();await page.waitForURL(/\/companies$/);
 const duplicate='Duplicate '+uid();await post(request,'search-configurations',{name:duplicate,criteria_version:1,criteria:{}});
 await page.goto('/search-configurations/new');await page.getByLabel('Configuration name').fill(duplicate);await page.getByRole('button',{name:'Save record',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('already used');await expect(page.getByLabel('Configuration name')).toHaveValue(duplicate);
 await page.getByLabel('Configuration name').fill(duplicate+' revised');await page.getByRole('button',{name:'Save record',exact:true}).click();await page.waitForURL(/\/search-configurations\/[a-f0-9-]+$/);
 await page.goto('/vacancies/ffffffff-ffff-4fff-8fff-ffffffffffff');await expect(page.getByRole('heading',{name:'Record not found'})).toBeVisible();
});
test('manual observations deduplicate and Back restores applied filters',async({page})=>{
 const company=await createCompany(page,'Manual Company '+uid());const external='manual-'+uid();
 async function record() {
  await page.goto('/vacancies/new');await page.getByLabel('Company',{exact:true}).selectOption(company);await page.getByLabel('Title',{exact:true}).fill('Manual Rust vacancy');
  await page.getByLabel('External vacancy ID',{exact:true}).fill(external);await page.getByRole('button',{name:'Save record',exact:true}).click();await page.waitForURL(/\/vacancies\/[a-f0-9-]+$/);
  return page.url();
 }
 const first=await record();await record();expect(page.url()).toBe(first);await expect(page.locator('.panel').filter({has:page.getByRole('heading',{name:'Discovery history'})}).locator('article')).toHaveCount(2);
 await page.goto('/vacancies');await page.getByLabel('Search',{exact:true}).fill('Manual Rust');await page.getByRole('button',{name:'Apply filters'}).click();await page.waitForURL(/q=Manual/);
 await expect(page.getByRole('heading',{name:'Manual Rust vacancy',exact:true})).toBeVisible();await page.getByRole('link',{name:'Clear',exact:true}).click();await page.waitForURL(/\/vacancies$/);
 await page.goBack();await expect(page.getByLabel('Search',{exact:true})).toHaveValue('Manual Rust');
});
