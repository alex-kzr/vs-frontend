import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, useLoaderData, useLocation, useNavigate, type LoaderFunctionArgs } from 'react-router';
import { CheckboxFilter, SearchableCheckboxFilter } from './filter-select';
import { api, all, ApiError } from './api';
import { clientUuid } from './identity';
import { DraftGuard, External, Field, Problem, Refresh, Time, useMutation } from './ui';
import type { ApiProblem, Json } from './types';
import type { CV, CVOrigin, CVRevision, RevisionMeta } from './cv-types';
import { sourceKinds, sourceLabel } from './cv-types';

type DetailData={cv:CV;revisions:RevisionMeta[];revision:CVRevision};
async function detailLoader({params,request}:LoaderFunctionArgs):Promise<DetailData> {
 const cv=(await api<{data:CV}>('cvs/'+params.id,{signal:request.signal})).data;
 const revisions=await all<RevisionMeta>('cvs/'+params.id+'/revisions',request.signal);
 const revision=params.revisionId?(await api<{data:CVRevision}>('cvs/'+params.id+'/revisions/'+params.revisionId,{signal:request.signal})).data:cv.revision!;
 return {cv,revisions,revision};
}
interface ListData {cvs:CV[];sources:CVOrigin[];states:string[]}
interface ImportData {cv:CV|null;sources:CVOrigin[]}
function CVList() {
 const data=useLoaderData<ListData>();const location=useLocation();
 return <CVListView key={location.search} {...data} search={location.search}/>;
}
function CVListView({cvs,sources,states,search}:{cvs:CV[];sources:CVOrigin[];states:string[];search:string}) {
 const navigate=useNavigate();const params=new URLSearchParams(search);const selected=params.getAll('source_code');
 const [sourceSearch,setSourceSearch]=useState(params.get('source_search')||'');
 const options=sources.map(s=>({id:s.code,label:s.label}));
 function context(){const p=new URLSearchParams(search);p.delete('cursor');if(sourceSearch)p.set('source_search',sourceSearch);else p.delete('source_search');return p;}
 function apply(event:FormEvent<HTMLFormElement>){event.preventDefault();const p=context();const form=new FormData(event.currentTarget);p.delete('deleted');p.delete('cv_state');p.delete('source_code');const choices=form.getAll('cv_state').map(String);for(const value of choices.length?choices:['all'])p.append('cv_state',value);for(const value of form.getAll('source_code'))p.append('source_code',String(value));void navigate('/cvs'+(p.size?'?'+p:''));}
 function clearSources(){const p=context();p.delete('source_code');return '/cvs'+(p.size?'?'+p:'');}
 return <section className="page"><div className="page-title"><div><h1>Мои CV</h1><p className="lede">Отдельные резюме, версии и происхождение содержимого.</p></div><div className="actions"><Link className="button" to="/cvs/new">+ Импортировать CV</Link><Refresh/></div></div>
 <form className="filters panel" onSubmit={apply}>
 <CheckboxFilter label="Состояние CV" name="cv_state" options={[{id:'active',label:'Активные'},{id:'deleted',label:'Удалённые'}]} selected={states}/>
 {sources.length>6?<SearchableCheckboxFilter label="Источник CV" name="source_code" options={options} selected={selected} searchLabel="Поиск источников CV" searchQuery={sourceSearch} onSearchQueryChange={setSourceSearch}/>:<CheckboxFilter label="Источник CV" name="source_code" options={options} selected={selected}/>}
 <button>Применить фильтры</button>{selected.length>0&&<Link className="button secondary" to={clearSources()}>Сбросить источник</Link>}</form>
 <p className="hint">По умолчанию выбраны активные CV. Обе галочки или пустой выбор состояния показывают все CV. Для восстановления откройте удалённое CV и нажмите «Восстановить CV». Версии и прежние пакеты сохраняются.</p>
 {!cvs.length?<div className="empty"><h2>CV по выбранным условиям нет</h2>{!selected.length&&<Link className="button" to="/cvs/new">Импортировать CV</Link>}</div>:<div className="record-list">{cvs.map(cv=><Link className="record-row" key={cv.id} to={'/cvs/'+cv.id} state={{cvListSearch:context().toString()}}><div className="record-main"><h3>{cv.name}</h3><p>{sourceLabel(cv.source_code)}</p></div><div className="record-meta"><span>Версия {cv.current_revision_number}</span><span>{cv.deleted_at?'Удалено':'Активное'}</span><Time value={cv.deleted_at||cv.imported_at}/></div></Link>)}</div>}
 </section>;
}
function CVLifecycle({cv}:{cv:CV}) {
 const mutation=useMutation();const dialog=useRef<HTMLDialogElement>(null);const [confirming,setConfirming]=useState(false);
 const deleted=!!cv.deleted_at;const body={confirmed:true,expected_revision_id:cv.current_revision_id,expected_lifecycle_version:cv.lifecycle_version};
 useEffect(()=>{if(mutation.result?.ok)dialog.current?.close();},[mutation.result]);
 function open(){setConfirming(true);dialog.current?.showModal();}
 function act(){if(!mutation.pending)mutation.submit('cvs/'+cv.id+(deleted?'/restore':'/delete'),'POST',body);}
 return <div><Problem error={confirming?null:mutation.error}/><button type="button" className={deleted?'button':'secondary danger'} disabled={mutation.pending} onClick={deleted?act:open}>{mutation.pending?'Сохранение…':deleted?'Восстановить CV':'Удалить CV'}</button>
 {!confirming&&mutation.error&&<button type="button" className="secondary" disabled={mutation.pending} onClick={mutation.retry}>Повторить предыдущий запрос</button>}
 <dialog className="cv-dialog" ref={dialog} aria-labelledby="cv-delete-title" onClose={()=>setConfirming(false)} onCancel={event=>{if(mutation.pending)event.preventDefault();}}>
 <h2 id="cv-delete-title">Удалить CV?</h2><p>«{cv.name}» исчезнет из активного списка и выбора для нового сопоставления. Его можно восстановить в разделе «Удалённые CV».</p><p>Все версии и происхождение сохраняются. Уже созданные пакеты продолжат работу со своими зафиксированными входами.</p><Problem error={confirming?mutation.error:null}/>
 <div className="actions"><button type="button" className="secondary" disabled={mutation.pending} onClick={()=>dialog.current?.close()}>Отмена</button><button type="button" className="danger" disabled={mutation.pending} onClick={act}>{mutation.pending?'Удаление…':'Подтвердить удаление'}</button>{mutation.error&&<button type="button" className="secondary" disabled={mutation.pending} onClick={mutation.retry}>Повторить предыдущий запрос</button>}</div></dialog></div>;
}
export function RevisionContent({revision}:{revision:CVRevision}) {
 return <><div className="panel"><h2>Содержимое CV · версия {revision.revision_number}</h2><p className="preserve cv-content" id="cv-content">{revision.content}</p><h3>Структурированные сведения</h3><pre>{JSON.stringify(revision.structured,null,2)}</pre></div>
 <div className="panel"><h2>Происхождение версии</h2><dl><dt>Источник CV</dt><dd>{sourceLabel(revision.source_code||(revision.hh_url?'hh.ru':'manual'))}</dd><dt>Способ импорта</dt><dd>{sourceKinds[revision.source.kind]||revision.source.kind}</dd><dt>Просмотр / ввод</dt><dd><Time value={revision.source.observed_at}/></dd><dt>Импорт в базу</dt><dd><Time value={revision.imported_at}/></dd><dt>Ссылка источника</dt><dd><External url={revision.source_url||revision.hh_url}/></dd>{revision.external_id&&<><dt>Внешний ID</dt><dd>{revision.external_id}</dd></>}{revision.source.file_name&&<><dt>Файл</dt><dd>{revision.source.file_name}</dd></>}{revision.source.agent&&<><dt>Агент</dt><dd>{revision.source.agent}</dd></>}</dl></div></>;
}
function CVDetail() {
 const {cv,revisions,revision}=useLoaderData<DetailData>();const location=useLocation();const historical=revision.id!==cv.current_revision_id;
 const search=new URLSearchParams((location.state as {cvListSearch?:string}|null)?.cvListSearch??(cv.deleted_at?'cv_state=deleted':''));search.delete('cursor');
 const back='/cvs'+(search.size?'?'+search:'');const routeState={cvListSearch:search.toString()};
 return <section className="page"><Link className="backlink" to={back}>← Мои CV</Link><div className="page-title"><div><h1>{revision.name}</h1><p>{sourceLabel(cv.source_code)} · {historical?'Историческая версия':'Текущая версия'} {revision.revision_number}</p></div><div className="actions"><Refresh/>{!cv.deleted_at&&<><Link className="button secondary" state={routeState} to={'/cvs/'+cv.id+'/edit'}>Создать новую версию</Link><Link className="button" to={'/match-runs/new?cv_id='+cv.id}>Выбрать вакансии для сопоставления</Link></>}<CVLifecycle key={cv.id+':'+cv.current_revision_id+':'+cv.lifecycle_version} cv={cv}/></div></div>
 {cv.deleted_at&&<p className="problem" role="status">CV удалено из активного списка. Для новых версий и сопоставлений сначала восстановите его. История доступна полностью.</p>}
 <div className="detail-grid"><div><RevisionContent revision={revision}/></div><div className="panel"><h2>История версий</h2>{revisions.map(r=><article className="source" key={r.id}><Link state={routeState} to={'/cvs/'+cv.id+'/revisions/'+r.id}>Версия {r.revision_number} · {r.name}</Link><p>{sourceKinds[r.source.kind]}</p><Time value={r.imported_at}/></article>)}</div></div></section>;
}
type Draft={name:string;hh_url:string|null;source_code:string;source_url:string|null;external_id:string|null;content:string;structured:Json;source:{kind:string;observed_at:string;file_name:string|null}};
function CVImport() {
 const {cv,sources}=useLoaderData<ImportData>();const navigate=useNavigate();const mutation=useMutation();
 const [origin,setOrigin]=useState(cv?.source_code||'manual');const [customOrigin,setCustomOrigin]=useState('');const [externalId,setExternalId]=useState(cv?.external_id||'');
 const [name,setName]=useState(cv?.name||'');const [link,setLink]=useState(cv?.source_url||cv?.hh_url||'');const [content,setContent]=useState(cv?.revision?.content||'');
 const [structured,setStructured]=useState(JSON.stringify(cv?.revision?.structured||{},null,2));const [fileName,setFileName]=useState<string|null>(null);
 const [dirty,setDirty]=useState(false);const [preview,setPreview]=useState<Draft|null>(null);const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);const [error,setError]=useState<ApiProblem|null>(null);const controller=useRef<AbortController|null>(null);const fileToken=useRef(0);
 const success=mutation.result?.ok===true;
 useEffect(()=>()=>{controller.current?.abort();fileToken.current++;},[]);
 useEffect(()=>{if(mutation.result?.ok)void navigate('/cvs/'+mutation.result.data.id);},[mutation.result,navigate]);
 function invalidate(){fileToken.current++;controller.current?.abort();setBusy(false);setDirty(true);setPreview(null);setConfirmed(false);setError(null);if(success)mutation.reset();}
 async function file(event:ChangeEvent<HTMLInputElement>) {
  const f=event.target.files?.[0];if(!f)return;invalidate();const token=fileToken.current;setBusy(true);
  try {
   if(!/\.(txt|md)$/i.test(f.name)||f.size>256*1024)throw new Error('Выберите .txt или .md до 256 КиБ в UTF-8.');
   const text=new TextDecoder('utf-8',{fatal:true}).decode(await f.arrayBuffer());
   if(fileToken.current!==token)return;setContent(text);setFileName(f.name);if(!name)setName(f.name.replace(/\.(txt|md)$/i,''));
  }catch(e){setError({code:'validation_failed',message:e instanceof Error&&/[А-Яа-яЁё]/.test(e.message)?e.message:'Файл должен содержать текст UTF-8.',fields:{}});}
  finally {if(fileToken.current===token)setBusy(false);event.target.value='';}
 }
 async function review(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();setError(null);setConfirmed(false);const abort=new AbortController();controller.current?.abort();controller.current=abort;
  try {
   let info:Json;try{info=JSON.parse(structured);}catch{throw new Error('Проверьте JSON структурированных сведений.');}
   const code=origin==='other'?customOrigin.trim().toLowerCase():origin;
   const draft:Draft={name,hh_url:code==='hh.ru'||code==='manual'?link.trim()||null:null,source_code:code,source_url:link.trim()||null,external_id:externalId.trim()||null,content,structured:info,source:{kind:fileName?'manual_file':cv?'manual_edit':'manual_text',observed_at:new Date().toISOString(),file_name:fileName}};
   setBusy(true);
   const body={...draft};
   const result=await api<{data:Draft}>('cvs/import-preview',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':clientUuid()},body:JSON.stringify(body),signal:abort.signal});
   if(!abort.signal.aborted)setPreview(result.data);
  }catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof ApiError?e.problem:{code:'validation_failed',message:e instanceof Error?e.message:'Проверьте данные CV.',fields:{}});}
  finally {if(controller.current===abort)setBusy(false);}
 }
 function save(){if(preview&&confirmed)mutation.submit(cv?'cvs/'+cv.id+'/revisions':'cvs','POST',{...preview,confirmed:true,...(cv?{expected_revision_id:cv.current_revision_id}:{})});}
 if(cv?.deleted_at)return <section className="page"><h1>CV удалено</h1><p>Сначала восстановите CV, чтобы создать новую версию.</p><Link className="button" to={'/cvs/'+cv.id}>Открыть CV для восстановления</Link></section>;
 return <section className="page"><Link className="backlink" to={cv?'/cvs/'+cv.id:'/cvs'}>← Мои CV</Link><h1>{cv?'Новая версия CV':'Импорт CV'}</h1><p className="lede">Просмотрите содержимое перед сохранением.</p><DraftGuard dirty={dirty&&!success}/>
 <p className="hint">Прямой импорт из HH в этом интерфейсе ещё не подключён. Вставьте текст из открытого вами резюме или загрузите .txt / .md. Ссылка HH хранится как происхождение; приложение её не загружает.</p>
 <Problem error={error||mutation.error}/>{mutation.error?.code==='cv_deleted_duplicate_source'&&<Link className="button secondary" to={'/cvs?cv_state=deleted&source_code='+encodeURIComponent(origin==='other'?customOrigin:origin)}>Открыть удалённые CV для восстановления</Link>}<form onSubmit={event=>void review(event)} onChange={event=>{if(event.target instanceof HTMLInputElement&&event.target.type==='file')return;invalidate();}}>
 <fieldset disabled={busy||mutation.pending}><legend>Данные CV</legend>
 <Field label="Название CV" name="name" value={name} onChange={e=>setName(e.target.value)} maxLength={300} required/>
 <Field label="Источник CV" name="source_code"><select id="source_code" name="source_code" value={origin} disabled={!!cv} onChange={e=>setOrigin(e.target.value)}>{sources.map(s=><option key={s.code} value={s.code}>{s.label}</option>)}<option value="other">Другой источник</option></select></Field>
 {origin==='other'&&<Field label="Домен другого источника" name="custom_source" value={customOrigin} onChange={e=>setCustomOrigin(e.target.value)} placeholder="example.org" required maxLength={253}/>}
 <Field label={origin==='manual'||origin==='hh.ru'?'Ссылка на резюме HH':'Ссылка на CV в источнике'} name="hh_url" value={link} readOnly={!!cv} onChange={e=>setLink(e.target.value)} placeholder={origin==='hh.ru'?'https://hh.ru/resume/ID':'HTTPS ссылка на CV'}/>
 {origin!=='manual'&&origin!=='hh.ru'&&<Field label="Внешний ID CV (если известен)" name="external_id" value={externalId} readOnly={!!cv} onChange={e=>setExternalId(e.target.value)} maxLength={300}/>}
 <p className="hint">Для ссылки HH выберите hh.ru. Источник отделён от способа импорта. skillstaff.ru и другие домены сохраняют только введённые вами сведения; подключение к ним не выполняется.</p>
 <Field label="Файл CV (.txt / .md)" name="cv_file" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={event=>void file(event)}/>
 <Field label="Содержимое CV" name="content"><textarea id="content" name="content" value={content} onChange={e=>setContent(e.target.value)} required maxLength={200000} rows={12}/></Field>
 <Field label="Структурированные сведения (JSON)" name="structured"><textarea id="structured" name="structured" value={structured} onChange={e=>setStructured(e.target.value)} rows={6}/></Field><p className="hint">Необязательно: summary, skills, experience (role, details), education. Сведения вводятся явно; навыки не дописываются автоматически.</p>
 <button>Предпросмотр CV</button> <Link className="button secondary" to={cv?'/cvs/'+cv.id:'/cvs'}>Отмена</Link></fieldset>
 </form>{busy&&<p role="status">Подготовка предпросмотра… <button className="secondary" onClick={()=>{fileToken.current++;controller.current?.abort();setBusy(false);}}>Отменить предпросмотр</button></p>}
 {preview&&<section className="panel"><h2>Проверьте импорт</h2><h3>{preview.name}</h3><p>{sourceLabel(preview.source_code)} · {preview.source_url||'Ссылка не указана'} · {sourceKinds[preview.source.kind]} {preview.source.file_name||''}</p><p className="preserve cv-content">{preview.content}</p><pre>{JSON.stringify(preview.structured,null,2)}</pre>
 <label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Я проверил(а) содержимое и происхождение CV</label>
 <div className="actions"><button type="button" disabled={!confirmed||mutation.pending} onClick={save}>{mutation.pending?'Сохранение…':cv?'Сохранить новую версию':'Сохранить CV'}</button>{mutation.error&&<button className="secondary" disabled={mutation.pending} onClick={mutation.retry}>Повторить предыдущий запрос</button>}</div><p className="hint">Сопоставление не запускается при сохранении CV.</p>
 </section>}</section>;
}
export const cvRoutes=[
 {path:'cvs',loader:async({request}:LoaderFunctionArgs):Promise<ListData>=>{const p=new URL(request.url).searchParams;const q=new URLSearchParams();const values=p.getAll('cv_state');const states=values.length?values.filter(value=>value!=='all'):p.get('deleted')==='true'?['deleted']:['active'];for(const state of values)q.append('cv_state',state);if(p.has('deleted'))q.set('deleted',p.get('deleted')!);for(const code of p.getAll('source_code'))q.append('source_code',code);const[cvs,sources]=await Promise.all([all<CV>('cvs'+(q.size?'?'+q:''),request.signal),all<CVOrigin>('cv-sources',request.signal)]);return {cvs,sources,states};},Component:CVList},
 {path:'cvs/new',loader:async({request}:LoaderFunctionArgs):Promise<ImportData>=>({cv:null,sources:await all<CVOrigin>('cv-sources',request.signal)}),Component:CVImport},
 {path:'cvs/:id',loader:detailLoader,Component:CVDetail},
 {path:'cvs/:id/edit',loader:async(args:LoaderFunctionArgs):Promise<ImportData>=>({cv:(await detailLoader(args)).cv,sources:await all<CVOrigin>('cv-sources',args.request.signal)}),Component:CVImport},
 {path:'cvs/:id/revisions/:revisionId',loader:detailLoader,Component:CVDetail},
];
