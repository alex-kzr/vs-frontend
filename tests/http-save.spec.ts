import {test,expect,chromium} from '@playwright/test';
import {createServer,request as forward} from 'node:http';

test('saving works without secure-context randomUUID and retains a failed-save draft',async({request,baseURL})=>{
 if(!baseURL||new URL(baseURL).hostname!=='127.0.0.1'||new URL(baseURL).port==='48173')throw new Error('Use an isolated loopback backend, never the operational database');
 const upstream=new URL(baseURL);
 // A loopback-only test proxy models the user's HTTP .local entry point.
 const proxy=createServer((incoming,outgoing)=>{
  const headers={...incoming.headers,host:upstream.host,...(incoming.headers.origin?{origin:upstream.origin}:{})};
  const relay=forward(new URL(incoming.url||'/',upstream),{method:incoming.method,headers},response=>{
   outgoing.writeHead(response.statusCode||502,response.headers);response.pipe(outgoing);
  });
  relay.on('error',()=>{outgoing.writeHead(502);outgoing.end('Isolated test upstream unavailable');});
  incoming.pipe(relay);
 });
 await new Promise<void>((resolve,reject)=>proxy.listen(0,'127.0.0.1',resolve).once('error',reject));
 const address=proxy.address();if(!address||typeof address==='string')throw new Error('Test proxy did not bind');
 const origin='http://vacancy-http.invalid:'+address.port;
 const browser=await chromium.launch({args:['--host-resolver-rules=MAP vacancy-http.invalid 127.0.0.1','--no-proxy-server']});
 try {
 const page=await browser.newPage();

 const companyResponse=await request.post('/api/v1/companies',{headers:{'Idempotency-Key':crypto.randomUUID()},data:{name:'HTTP-origin fixture '+crypto.randomUUID()}});
 expect(companyResponse.ok()).toBeTruthy();const company=(await companyResponse.json()).data;
 const imported=await request.post('/api/v1/vacancy-source-references',{headers:{'Idempotency-Key':crypto.randomUUID()},data:{source_id:'20000000-0000-4000-8000-000000000001',external_vacancy_id:crypto.randomUUID(),vacancy:{company_id:company.id,title:'HTTP-origin saving regression'},observation:{observation_key:crypto.randomUUID(),observed_at:new Date().toISOString()}}});
 expect(imported.ok()).toBeTruthy();const id=(await imported.json()).data.vacancy_id as string;
 await page.goto(origin+'/vacancies/'+id);
 expect(await page.evaluate(()=>isSecureContext)).toBe(false);
 expect(await page.evaluate(()=>typeof crypto.randomUUID)).toBe('undefined');
 expect(await page.evaluate(()=>typeof crypto.getRandomValues)).toBe('function');
 const note='Заметка на русском — HTTP fixture, user draft';
 await page.getByRole('radio',{name:'Я отказался',exact:true}).check();
 await page.getByLabel('Заметки',{exact:true}).fill(note);
 await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Сохранено в SQLite.');
 expect((await (await request.get('/api/v1/vacancies/'+id)).json()).data).toMatchObject({status:'declined_by_applicant',notes:note});
 await page.reload();await expect(page.getByRole('radio',{name:'Я отказался',exact:true})).toBeChecked();
 await expect(page.getByLabel('Заметки',{exact:true})).toHaveValue(note);
 const route='**/api/v1/vacancies/'+id;
 await page.route(route,r=>r.request().method()==='PATCH'?r.fulfill({status:422,json:{error:{code:'validation_failed',message:'Some fields are invalid.',fields:{status:['Unsupported status.']}}}}):r.continue());
 await page.getByRole('radio',{name:'Работодатель отказал',exact:true}).check();
 await page.getByLabel('Заметки',{exact:true}).fill(note+' / retry');
 await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Выберите допустимый статус вакансии.');
 await expect(page.getByLabel('Заметки',{exact:true})).toHaveValue(note+' / retry');
 expect((await (await request.get('/api/v1/vacancies/'+id)).json()).data.status).toBe('declined_by_applicant');
 await page.unroute(route);await page.getByRole('button',{name:'Повторить предыдущий запрос',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Сохранено в SQLite.');
 await page.reload();await expect(page.getByRole('radio',{name:'Работодатель отказал',exact:true})).toBeChecked();
 await expect(page.getByLabel('Заметки',{exact:true})).toHaveValue(note+' / retry');
 await page.screenshot({path:'test-results/http-save-success.png',fullPage:true});
 const history=(await (await request.get('/api/v1/vacancies/'+id+'/status-history')).json()).items;
 expect(history.map((x:{status:string})=>x.status)).toEqual(['rejected_by_employer','declined_by_applicant']);
 // POST flows also generate receipt and entity UUIDs in this context.
 await page.goto(origin+'/companies/new');await page.getByLabel('Название компании',{exact:true}).fill('Created over HTTP '+id);
 await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Created over HTTP '+id,exact:true})).toBeVisible();
 } finally {
  await browser.close();proxy.closeAllConnections();
  await new Promise<void>((resolve,reject)=>proxy.close(error=>error?reject(error):resolve()));
 }
});
