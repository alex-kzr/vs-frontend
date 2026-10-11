import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLoaderData, useNavigate, type LoaderFunctionArgs } from 'react-router';
import { api, all, ApiError } from './api';
import { clientUuid } from './identity';
import { CheckboxFilter, SearchableCheckboxFilter } from './filter-select';
import { RevisionContent } from './cvs';
import { Field, Select, Problem, Refresh, Time, useMutation, DraftGuard, choices, statuses } from './ui';
import { lookupLabel } from './i18n';
import type { ApiProblem, Company, Configuration, Json, Lookup, Page } from './types';
import type { CV, CVRevision, MatchRun, MatchJob, MatchAttempt, Finding } from './cv-types';
import { states } from './cv-types';

interface Selection {statuses:string[];company_ids:string[];q:string|null;source_id:string|null;search_configuration_id:string|null}
interface Preview {cv_id:string;cv_revision_id:string;cv_revision_number:number;cv_name:string;selection:Selection;count:number;vacancies:{id:string;title:string;company_name:string;status:string}[]}
interface NewData {cvs:CV[];companies:Company[];configs:Configuration[];sources:Lookup[];selected:string}
interface RunData {run:MatchRun;jobs:MatchJob[]}
interface JobData {run:MatchRun;data:MatchJob;cv_revision:CVRevision;attempts:MatchAttempt[]}
function MatchList() {
 const runs=useLoaderData<MatchRun[]>();
 return <section className="page"><div className="page-title"><div><h1>Сопоставления</h1><p className="lede">Явно выбранный CV и зафиксированные вакансии для внешнего агента.</p></div><Link className="button" to="/match-runs/new">+ Новый пакет</Link></div><p className="hint">Приложение хранит входы, результаты и историю попыток. Семантический анализ выполняет внешний агент по отдельному запросу пользователя.</p><Refresh/>
 {!runs.length?<div className="empty"><h2>Пакетов пока нет</h2><p>Выберите CV и вакансии, просмотрите состав и подтвердите создание.</p></div>:<div className="record-list">{runs.map(run=><Link className="record-row" key={run.id} to={'/match-runs/'+run.id}><div className="record-main"><h3>{run.cv_name} · версия {run.cv_revision_number}</h3><p>Готово {run.counts.completed} / {run.counts.total} · ошибок {run.counts.failed}{run.stale?' · входные данные изменились':''}</p></div><div className="record-meta"><span className="badge">{states[run.state]}</span><Time value={run.created_at}/></div></Link>)}</div>}</section>;
}
function MatchNew() {
 const {cvs,companies,configs,sources,selected}=useLoaderData<NewData>();const navigate=useNavigate();const mutation=useMutation();
 const [preview,setPreview]=useState<Preview|null>(null);const [confirmed,setConfirmed]=useState(false);const [busy,setBusy]=useState(false);const [dirty,setDirty]=useState(false);const [error,setError]=useState<ApiProblem|null>(null);const controller=useRef<AbortController|null>(null);
 const success=mutation.result?.ok===true;
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{if(mutation.result?.ok)void navigate('/match-runs/'+mutation.result.data.id);},[mutation.result,navigate]);
 function invalidate(){controller.current?.abort();setBusy(false);setPreview(null);setConfirmed(false);setDirty(true);setError(null);}
 async function review(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();const fd=new FormData(event.currentTarget);const cv=cvs.find(c=>c.id===fd.get('cv_id'));
  if(!cv)return;
  const selection:Selection={statuses:fd.getAll('status').map(String),company_ids:fd.getAll('company_id').map(String),q:String(fd.get('q')||'').trim()||null,source_id:String(fd.get('source_id')||'')||null,search_configuration_id:String(fd.get('search_configuration_id')||'')||null};
  const abort=new AbortController();controller.current?.abort();controller.current=abort;setBusy(true);setError(null);
  try{const result=await api<{data:Preview}>('match-runs/preview',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':clientUuid()},body:JSON.stringify({cv_id:cv.id,expected_revision_id:cv.current_revision_id,selection}),signal:abort.signal});if(!abort.signal.aborted)setPreview(result.data);}
  catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof ApiError?e.problem:{code:'network_error',message:'Не удалось загрузить предпросмотр.',fields:{}});}
  finally{if(controller.current===abort)setBusy(false);}
 }
 function create(){if(preview&&confirmed)mutation.submit('match-runs','POST',{cv_id:preview.cv_id,expected_revision_id:preview.cv_revision_id,selection:{...preview.selection},confirmed:true});}
 return <section className="page"><Link className="backlink" to="/match-runs">← Сопоставления</Link><h1>Новый пакет сопоставления</h1><p className="lede">Выберите конкретное CV и вакансии. По умолчанию — статус «Сохранена».</p><DraftGuard dirty={dirty&&!success}/><Problem error={error||mutation.error}/>
 {!cvs.length?<div className="empty"><h2>Сначала добавьте CV</h2><Link className="button" to="/cvs/new">Импортировать CV</Link></div>:<><form onSubmit={event=>void review(event)} onChange={invalidate}><fieldset disabled={busy||mutation.pending}><legend>Входы пакета</legend>
 <Select label="CV для сопоставления" name="cv_id" value={selected} required options={cvs.map(c=>({id:c.id,label:c.name+' · версия '+c.current_revision_number}))}/>
 <div className="filters"><CheckboxFilter label="Статусы вакансий" name="status" options={choices(statuses)} selected={['saved']}/><SearchableCheckboxFilter label="Компании" name="company_id" options={companies.map(c=>({id:c.id,label:c.name}))} selected={[]} searchLabel="Поиск компаний"/>
 <Field label="Поиск по названию вакансии" name="q" maxLength={200}/><Select label="Источник" name="source_id" options={sources.map(s=>({id:s.id,label:lookupLabel(s)}))}/><Select label="Профиль поиска" name="search_configuration_id" options={configs.map(c=>({id:c.id,label:c.name}))}/></div>
 <p className="hint">Пустой выбор статусов означает все статусы. До 100 вакансий за один пакет. Состав фиксируется при подтверждении создания.</p>
 <button>Предпросмотр выборки</button> <Link className="button secondary" to="/match-runs">Отмена</Link></fieldset></form>
 {busy&&<p role="status">Загрузка состава… <button className="secondary" onClick={()=>{controller.current?.abort();setBusy(false);}}>Отменить предпросмотр</button></p>}
 {preview&&<section className="panel"><h2>Состав пакета: {preview.count}</h2><p>{preview.cv_name} · версия {preview.cv_revision_number}</p><ul>{preview.vacancies.map(v=><li key={v.id}>{v.company_name} — {v.title}</li>)}</ul>
 {!preview.count?<p>Вакансий по выбранным условиям нет. Измените фильтры.</p>:<><label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Подтверждаю выбранные CV и вакансии</label><div className="actions"><button disabled={!confirmed||mutation.pending} onClick={create}>Создать пакет для агента</button>{mutation.error&&<button className="secondary" disabled={mutation.pending} onClick={mutation.retry}>Повторить предыдущий запрос</button>}</div><p className="hint">Создание пакета не обращается к LLM и не отправляет CV. Передайте пакет выбранному агенту отдельным действием.</p></>}
 </section>}</>}</section>;
}
function RunAction({path,body,label,confirmation}:{path:string;body:Json;label:string;confirmation?:string}) {
 const mutation=useMutation();const [armed,setArmed]=useState(false);
 return <div><Problem error={mutation.error}/>{armed&&<p>{confirmation}</p>}<button className="secondary" disabled={mutation.pending} onClick={()=>{if(confirmation&&!armed){setArmed(true);return;}mutation.submit(path,'POST',body);}}>{mutation.pending?'Сохранение…':armed?'Подтвердить: '+label:label}</button>
 {armed&&<button className="secondary" onClick={()=>setArmed(false)}>Оставить как есть</button>}{mutation.error&&<button className="secondary" disabled={mutation.pending} onClick={mutation.retry}>Повторить предыдущий запрос</button>}</div>;
}
function Stale({run}:{run:MatchRun}) {return run.stale?<p className="problem" role="status">Входные данные изменились: {run.cv_stale?'есть новая версия CV. ':''}{run.stale_vacancies?run.stale_vacancies+' вакансий изменены.':''} Этот пакет сохраняет исходные версии. Для нового анализа создайте отдельный пакет.</p>:null;}
function MatchDetail() {
 const {run,jobs}=useLoaderData<RunData>();
 return <section className="page"><Link className="backlink" to="/match-runs">← Сопоставления</Link><div className="page-title"><div><h1>Пакет: {run.cv_name}</h1><p>Версия {run.cv_revision_number} · {states[run.state]} · <Time value={run.created_at}/></p></div><Refresh/></div><Stale run={run}/>
 <div className="panel"><h2>Зафиксированные входы</h2><p>Завершено {run.counts.completed} из {run.counts.total}. В очереди {run.counts.pending}, у агента {run.counts.running}, ошибок {run.counts.failed}, отменено {run.counts.cancelled}.</p>
 <div className="actions"><Link to={'/cvs/'+run.cv_id+'/revisions/'+run.cv_revision_id}>Открыть версию CV</Link><a className="button secondary" href={'/api/v1/match-runs/'+run.id+'/inputs'} download={'match-'+run.id+'.json'}>Скачать входы для агента (JSON)</a><Link to={'/match-runs/new?cv_id='+run.cv_id}>Создать ещё пакет</Link></div>
 <p className="hint">JSON содержит CV и тексты вакансий. Дальнейший анализ выполняет внешний агент по вашему отдельному запросу; инструкция транспорта — docs/agent-matching.md.</p>
 {!['completed','cancelled'].includes(run.state)&&<RunAction key={run.state} path={'match-runs/'+run.id+'/cancel'} body={{}} label="Отменить пакет" confirmation="Незавершённые задания будут отменены, поздние ответы отозванных попыток не сохранятся. Уже готовые результаты останутся в истории."/>}
 </div><div className="record-list">{jobs.map(job=><article className="record-row" key={job.id}><div className="record-main"><h3><Link to={'/match-runs/'+run.id+'/jobs/'+job.id}>{job.vacancy_title}</Link></h3><p>{job.company_name} · попытка {job.attempt_number}</p>{job.error&&<p className="preserve">{job.error.message}</p>}</div><div className="record-meta"><span className="badge">{states[job.state]}</span>{job.stale&&<small>Входы изменились</small>}
 {!['cancelled','completed'].includes(run.state)&&['failed','running'].includes(job.state)&&<RunAction key={job.attempt_id+job.state} path={'match-runs/'+run.id+'/jobs/'+job.id+'/retry'} body={{attempt_id:job.attempt_id,cv_revision_id:run.cv_revision_id}} label="Вернуть в очередь" confirmation={job.state==='running'?'Текущая попытка будет отозвана. Поздний ответ от неё отклонится; новую попытку агент получит отдельным запросом.':undefined}/>}</div></article>)}</div></section>;
}
const dimensions:Record<string,string>={skills:'Навыки',experience:'Опыт',responsibilities:'Задачи',work_format:'Формат работы',language:'Языки',education:'Образование'};
function Findings({label,items}:{label:string;items:Finding[]}) {
 return <section className="panel"><h2>{label}</h2>{!items.length?<p className="hint">Агент не добавил выводов в этот раздел.</p>:items.map((item,i)=><article className="source" key={i}><h3>{dimensions[item.dimension]}</h3><p className="preserve">{item.statement}</p>{item.evidence.map((proof,j)=><blockquote className="evidence" key={j}><small>{proof.source==='cv'?'CV':'Вакансия'} · {proof.path}</small><p className="preserve">{proof.quote===null?'Поле не заполнено в зафиксированном входе.':proof.quote}</p></blockquote>)}</article>)}</section>;
}
function JobDetail() {
 const {run,data:job,cv_revision:revision,attempts}=useLoaderData<JobData>();
 return <section className="page"><Link className="backlink" to={'/match-runs/'+run.id}>← Пакет сопоставления</Link><div className="page-title"><div><h1>{job.snapshot.title}</h1><p>{job.snapshot.company.name} · {states[job.state]} · попытка {job.attempt_number}</p></div><Refresh/></div><Stale run={run}/>
 {job.engine?.kind==='synthetic'&&<p className="problem">Синтетический тестовый результат. Реальный LLM-анализ не выполнялся.</p>}
 {job.engine&&<p className="hint">Источник, указанный агентом: {job.engine.agent} · {job.engine.kind} {job.engine.provider||''} {job.engine.model||''} {job.engine.version||''}</p>}
 {job.error&&<p className="problem preserve">{job.error.code}: {job.error.message}</p>}
 {job.assessment?<><section className="panel"><h2>Объяснение агента</h2><p className="preserve">{job.assessment.summary}</p></section><div className="detail-grid"><div><Findings label="Совпадения" items={job.assessment.matches}/><Findings label="Пробелы" items={job.assessment.gaps}/></div><div><Findings label="Вопросы для уточнения" items={job.assessment.questions}/><Findings label="Недостаточно данных" items={job.assessment.unknowns}/></div></div></>:<div className="panel"><h2>Результата пока нет</h2><p>Пакет ждёт явного выполнения внешним агентом. Приложение само не анализирует CV и вакансии.</p></div>}
 <details className="panel"><summary>История попыток ({attempts.length})</summary>{attempts.map(attempt=><article className="source" key={attempt.id}><h3>Попытка {attempt.attempt_number} · {states[attempt.state]}</h3><Time value={attempt.updated_at}/>{attempt.error&&<p className="preserve">{attempt.error.message}</p>}{attempt.engine&&<p>{attempt.engine.agent} · {attempt.engine.kind}</p>}</article>)}</details>
 <details className="panel"><summary>Входы именно этого задания</summary><RevisionContent revision={revision}/><h2>Зафиксированная вакансия</h2><p className="preserve">{job.snapshot.title}</p><p className="preserve">{job.snapshot.description||'Описание не указано'}</p><Link to={'/vacancies/'+job.vacancy_id}>Текущая карточка вакансии</Link></details></section>;
}
export const matchingRoutes=[
 {path:'match-runs',loader:({request}:LoaderFunctionArgs)=>all<MatchRun>('match-runs',request.signal),Component:MatchList},
 {path:'match-runs/new',loader:async({request}:LoaderFunctionArgs):Promise<NewData>=>{const [cvs,companies,configs,sources]=await Promise.all([all<CV>('cvs',request.signal),all<Company>('companies',request.signal),all<Configuration>('search-configurations',request.signal),all<Lookup>('vacancy-sources',request.signal)]);return {cvs,companies,configs,sources,selected:new URL(request.url).searchParams.get('cv_id')||''};},Component:MatchNew},
 {path:'match-runs/:id',loader:async({params,request}:LoaderFunctionArgs):Promise<RunData>=>{const [run,jobs]=await Promise.all([api<{data:MatchRun}>('match-runs/'+params.id,{signal:request.signal}),api<Page<MatchJob>>('match-runs/'+params.id+'/jobs',{signal:request.signal})]);return {run:run.data,jobs:jobs.items};},Component:MatchDetail},
 {path:'match-runs/:id/jobs/:jobId',loader:async({params,request}:LoaderFunctionArgs):Promise<JobData>=>{const path='match-runs/'+params.id+'/jobs/'+params.jobId;const [result,attempts]=await Promise.all([api<Omit<JobData,'attempts'>>(path,{signal:request.signal}),api<Page<MatchAttempt>>(path+'/attempts',{signal:request.signal})]);return {...result,attempts:attempts.items};},Component:JobDetail},
];
