import { clientUuid } from './identity';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { all, api, ApiError } from './api';
import type { ApiProblem, Company, HhCriteria, Json, Lookup } from './types';
import { External, Problem, Select, useMutation } from './ui';
import { valueLabel } from './i18n';

interface Candidate {external_vacancy_id:string;external_url:string;company_name:string;vacancy:Record<string,Json> & {title:string;description:string|null;location:string|null;work_format:string|null};source_payload?:Record<string,Json>}
interface Preview {adapter:string;live:boolean;configuration_id:string;scanned:number;matched:number;candidates:Candidate[];page?:number;found?:number;accessible_pages?:number;next_page?:number|null;skipped?:number;notice?:string;fetched_at?:string}
interface PreviewResult {preview:Preview;companies:Company[];sources:Lookup[];requestId:string}
interface HhStatus {configured:boolean;message:string;registration_url:string;terms_url:string;agreement_url:string}
export async function previewLoader(id:string,signal:AbortSignal):Promise<PreviewResult> {
 const [preview,companies,sources]=await Promise.all([
  api<Preview>('search-configurations/'+id+'/preview',{signal}),all<Company>('companies',signal),all<Lookup>('vacancy-sources',signal),
 ]);
 return {preview,companies,sources,requestId:clientUuid()};
}
export function SearchPreview({configurationId,hh}: {configurationId:string;hh?:HhCriteria}) {
 const [status,setStatus]=useState<HhStatus|null>(null);
 const [result,setResult]=useState<PreviewResult|null>(null);
 const [error,setError]=useState<ApiProblem|null>(null);
 const [pending,setPending]=useState(false);
 const [message,setMessage]=useState('');
 const active=useRef<{controller:AbortController;id:string;adapter:string}|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  void api<HhStatus>('hh/status',{signal:controller.signal}).then(setStatus).catch(e=>{if(!controller.signal.aborted)setError(e instanceof ApiError?e.problem:{code:'status_error',message:'Не удалось проверить доступ к HH.',fields:{}});});
  return ()=>{controller.abort();const request=active.current;if(request){request.controller.abort();if(request.adapter==='hh')void api('hh/requests/'+request.id,{method:'DELETE'}).catch(()=>undefined);}};
 },[]);
 function stop() {
  const request=active.current;if(!request)return;
  request.controller.abort();if(request.adapter==='hh')void api('hh/requests/'+request.id,{method:'DELETE'}).catch(()=>undefined);
  active.current=null;setPending(false);setMessage('Просмотр отменён. Вакансии не импортированы.');
 }
 async function search(adapter:string,page=0) {
  stop();const request={controller:new AbortController(),id:clientUuid(),adapter};active.current=request;
  setPending(true);setError(null);setMessage('');setResult(null);
  try {
   const [preview,companies,sources]=await Promise.all([
    api<Preview>('search-configurations/'+configurationId+'/preview?adapter='+adapter+'&page='+page+'&request_id='+request.id,{signal:request.controller.signal}),
    all<Company>('companies',request.controller.signal),all<Lookup>('vacancy-sources',request.controller.signal),
   ]);
   if(active.current===request)setResult({preview,companies,sources,requestId:request.id});
  }catch(e){if(!request.controller.signal.aborted)setError(e instanceof ApiError?e.problem:{code:'preview_error',message:'Не удалось загрузить просмотр. Повторите вручную.',fields:{}});}
  finally{if(active.current===request){active.current=null;setPending(false);}}
 }
 return <div className="panel"><h2>Просмотр результатов поиска</h2>
  <p className="hint">Для hh.ru требуется разрешённый доступ к официальному API. Просмотр не сохраняет вакансии; импортируйте только выбранные. Тестовые вакансии доступны без сети.</p>
  {status&&!status.configured&&<div className="empty-inline"><strong>Требуется настройка доступа к HH</strong><p>{status.message.includes('HH_USER_AGENT')?'Проверьте HH_USER_AGENT: название и версия зарегистрированного приложения, контакт разработчика.':status.message.includes('HH_API_TOKEN')?'Проверьте локальную настройку разрешённого токена HH.':'Доступ к API HH не настроен. Требуется регистрация приложения и разрешённый доступ.'}</p><p>Зарегистрируйте своё приложение и настройте разрешённый доступ локально по README. Не вводите секреты в интерфейс.</p><External url={status.registration_url}>Регистрация приложения HH</External> · <External url={status.terms_url}>Условия API HH</External> · <External url={status.agreement_url}>Договор содействия трудоустройству (оферта)</External></div>}
  {!hh?.text&&<p className="hint">Измените профиль, чтобы добавить свой запрос HH и фильтры.</p>}
  <div className="actions"><button disabled={pending||!status?.configured||!hh?.text} onClick={()=>void search('hh')}>Просмотреть hh.ru</button>
   <button className="secondary" disabled={pending} onClick={()=>void search('fixture-v1')}>Просмотреть тестовые вакансии</button>
   {pending&&<button className="secondary" onClick={stop}>Отменить просмотр</button>}</div>
  <Problem error={error}/>{error?.retry_after_seconds&&<p role="status">До следующего запроса подождите не менее {error.retry_after_seconds} секунд. Автоматического повтора нет.</p>}
  <p role="status" aria-live="polite">{pending?'Загрузка одной страницы…':message}</p>
  {result&&<><p>{result.preview.live?'На странице HH '+((result.preview.page||0)+1)+': '+result.preview.matched+' вакансий. Всего найдено '+result.preview.found+'; в пределах лимита доступно '+result.preview.accessible_pages+' страниц.':'Совпало '+result.preview.matched+' из '+result.preview.scanned+' тестовых вакансий.'}</p>
   {result.preview.notice&&<p className="hint">Применяется синтаксис поиска HH. Описания представлены фрагментами. Результаты между страницами могут изменяться; автоматического импорта нет.</p>}{Boolean(result.preview.skipped)&&<p className="hint">Пропущено повторяющихся или несовместимых записей: {result.preview.skipped}.</p>}
   {result.preview.candidates.map(candidate=><CandidateImport key={result.requestId+candidate.external_vacancy_id} candidate={candidate} data={result}/>)}
   {result.preview.live&&<div className="actions">{(result.preview.page||0)>0&&<button className="secondary" onClick={()=>void search('hh',(result.preview.page||0)-1)}>Предыдущая страница HH</button>}{result.preview.next_page!==null&&result.preview.next_page!==undefined&&<button className="secondary" onClick={()=>void search('hh',result.preview.next_page!)}>Следующая страница HH</button>}</div>}
  </>}
 </div>;
}
function CandidateImport({candidate,data}: {candidate:Candidate;data:PreviewResult}) {
 const mutation=useMutation();const [companyId,setCompanyId]=useState('');const [observation]=useState(()=>({key:clientUuid(),time:typeof candidate.source_payload?.fetched_at==='string'?candidate.source_payload.fetched_at:new Date().toISOString()}));
 const success=mutation.result?.ok?mutation.result.data:null;
 const source=data.sources.find(s=>s.code===data.preview.adapter);
 const salary=candidate.source_payload?.salary as Record<string,Json>|null|undefined;
 const mode=salary?.mode as Record<string,Json>|null|undefined;
 return <article className="source"><h3>{candidate.vacancy.title}</h3><p>{candidate.company_name} · {candidate.vacancy.location||'Место не указано'} · {candidate.vacancy.work_format?valueLabel(candidate.vacancy.work_format):'См. формат работы в источнике'}</p>
  <External url={candidate.external_url}>Открыть вакансию в источнике</External>
  {data.preview.live&&<p className="hint">Фрагмент поисковой выдачи HH; полное описание смотрите в источнике.</p>}<p className="preserve">{candidate.vacancy.description||'Фрагмент описания отсутствует.'}</p>
  {salary&&<p>Зарплата HH: {String(salary.from??'не указано')}–{String(salary.to??'не указано')} {String(salary.currency||'')} · {salary.gross===true?'до налогов':salary.gross===false?'после налогов':'налоги не указаны'} · {mode?.id?valueLabel(String(mode.id)):'период не указан'}</p>}
  {success?<p role="status">Импортировано в SQLite. <Link to={'/vacancies/'+success.vacancy_id}>Открыть вакансию →</Link></p>:<>
   <Problem error={mutation.error}/>
   <Select label={'Компания для импорта '+candidate.external_vacancy_id} name={'company-'+candidate.external_vacancy_id} options={data.companies.map(c=>({id:c.id,label:c.name}))} required onChange={setCompanyId}/>
   <p className="hint">Выберите соответствующую компанию. Совпадение названий не объединяет компании автоматически.</p>
   <button disabled={!companyId||!source||mutation.pending} onClick={()=>mutation.submit('vacancy-source-references','POST',{
    source_id:source!.id,external_vacancy_id:candidate.external_vacancy_id,external_url:candidate.external_url,
    vacancy:{...candidate.vacancy,company_id:companyId},observation:{observation_key:observation.key,observed_at:observation.time,search_configuration_id:data.preview.configuration_id,...(candidate.source_payload?{source_payload:candidate.source_payload}:{})},
   })}>{mutation.pending?'Сохранение…':'Импортировать выбранную вакансию'}</button>{data.companies.length===0&&<Link to="/companies/new">Сначала создайте компанию</Link>}
   {mutation.error&&<button className="secondary" onClick={mutation.retry} disabled={mutation.pending}>Повторить предыдущий запрос</button>}
  </>}
 </article>;
}
