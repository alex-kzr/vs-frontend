import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, useLoaderData, useNavigate, type LoaderFunctionArgs } from 'react-router';
import { api, all, ApiError } from './api';
import { clientUuid } from './identity';
import { DraftGuard, External, Field, Problem, Refresh, Time, useMutation } from './ui';
import type { ApiProblem, Json } from './types';
import type { CV, CVRevision, RevisionMeta } from './cv-types';
import { sourceKinds } from './cv-types';

type DetailData={cv:CV;revisions:RevisionMeta[];revision:CVRevision};
async function detailLoader({params,request}:LoaderFunctionArgs):Promise<DetailData> {
 const cv=(await api<{data:CV}>('cvs/'+params.id,{signal:request.signal})).data;
 const revisions=await all<RevisionMeta>('cvs/'+params.id+'/revisions',request.signal);
 const revision=params.revisionId?(await api<{data:CVRevision}>('cvs/'+params.id+'/revisions/'+params.revisionId,{signal:request.signal})).data:cv.revision!;
 return {cv,revisions,revision};
}
function CVList() {
 const cvs=useLoaderData<CV[]>();
 return <section className="page"><div className="page-title"><div><h1>Мои CV</h1><p className="lede">Отдельные резюме, версии и происхождение содержимого.</p></div><Link className="button" to="/cvs/new">+ Импортировать CV</Link></div>
 <p className="hint">Импорт и редактирование сохраняют данные локально. Сопоставление создаётся отдельным действием в разделе «Сопоставления».</p><Refresh/>
 {!cvs.length?<div className="empty"><h2>Пока нет CV</h2><p>Вставьте проверенный текст или выберите файл .txt / .md.</p><Link className="button" to="/cvs/new">Импортировать первое CV</Link></div>:<div className="record-list">{cvs.map(cv=><Link className="record-row" key={cv.id} to={'/cvs/'+cv.id}><div className="record-main"><h3>{cv.name}</h3><p>{cv.hh_url||'Ссылка HH не указана'}</p></div><div className="record-meta"><span>Версия {cv.current_revision_number}</span><Time value={cv.imported_at}/></div></Link>)}</div>}
 </section>;
}
export function RevisionContent({revision}:{revision:CVRevision}) {
 return <><div className="panel"><h2>Содержимое CV · версия {revision.revision_number}</h2><p className="preserve cv-content" id="cv-content">{revision.content}</p><h3>Структурированные сведения</h3><pre>{JSON.stringify(revision.structured,null,2)}</pre></div>
 <div className="panel"><h2>Происхождение версии</h2><dl><dt>Способ</dt><dd>{sourceKinds[revision.source.kind]||revision.source.kind}</dd><dt>Просмотр / ввод</dt><dd><Time value={revision.source.observed_at}/></dd><dt>Импорт в базу</dt><dd><Time value={revision.imported_at}/></dd><dt>Ссылка HH</dt><dd><External url={revision.hh_url}/></dd>{revision.source.file_name&&<><dt>Файл</dt><dd>{revision.source.file_name}</dd></>}{revision.source.agent&&<><dt>Агент</dt><dd>{revision.source.agent}</dd></>}</dl></div></>;
}
function CVDetail() {
 const {cv,revisions,revision}=useLoaderData<DetailData>();const historical=revision.id!==cv.current_revision_id;
 return <section className="page"><Link className="backlink" to="/cvs">← Мои CV</Link><div className="page-title"><div><h1>{revision.name}</h1><p>{historical?'Историческая версия':'Текущая версия'} {revision.revision_number}</p></div><div className="actions"><Refresh/><Link className="button secondary" to={'/cvs/'+cv.id+'/edit'}>Создать новую версию</Link><Link className="button" to={'/match-runs/new?cv_id='+cv.id}>Выбрать вакансии для сопоставления</Link></div></div>
 <div className="detail-grid"><div><RevisionContent revision={revision}/></div><div className="panel"><h2>История версий</h2>{revisions.map(r=><article className="source" key={r.id}><Link to={'/cvs/'+cv.id+'/revisions/'+r.id}>Версия {r.revision_number} · {r.name}</Link><p>{sourceKinds[r.source.kind]}</p><Time value={r.imported_at}/></article>)}</div></div></section>;
}
type Draft={name:string;hh_url:string|null;content:string;structured:Json;source:{kind:string;observed_at:string;file_name:string|null}};
function CVImport() {
 const cv=useLoaderData<CV|null>();const navigate=useNavigate();const mutation=useMutation();
 const [name,setName]=useState(cv?.name||'');const [link,setLink]=useState(cv?.hh_url||'');const [content,setContent]=useState(cv?.revision?.content||'');
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
   const draft:Draft={name,hh_url:link.trim()||null,content,structured:info,source:{kind:fileName?'manual_file':cv?'manual_edit':'manual_text',observed_at:new Date().toISOString(),file_name:fileName}};
   setBusy(true);
   const body={...draft};
   const result=await api<{data:Draft}>('cvs/import-preview',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':clientUuid()},body:JSON.stringify(body),signal:abort.signal});
   if(!abort.signal.aborted)setPreview(result.data);
  }catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof ApiError?e.problem:{code:'validation_failed',message:e instanceof Error?e.message:'Проверьте данные CV.',fields:{}});}
  finally {if(controller.current===abort)setBusy(false);}
 }
 function save(){if(preview&&confirmed)mutation.submit(cv?'cvs/'+cv.id+'/revisions':'cvs','POST',{...preview,confirmed:true,...(cv?{expected_revision_id:cv.current_revision_id}:{})});}
 return <section className="page"><Link className="backlink" to={cv?'/cvs/'+cv.id:'/cvs'}>← Мои CV</Link><h1>{cv?'Новая версия CV':'Импорт CV'}</h1><p className="lede">Просмотрите содержимое перед сохранением.</p><DraftGuard dirty={dirty&&!success}/>
 <p className="hint">Прямой импорт из HH в этом интерфейсе ещё не подключён. Вставьте текст из открытого вами резюме или загрузите .txt / .md. Ссылка HH хранится как происхождение; приложение её не загружает.</p>
 <Problem error={error||mutation.error}/><form onSubmit={event=>void review(event)} onChange={event=>{if(event.target instanceof HTMLInputElement&&event.target.type==='file')return;invalidate();}}>
 <fieldset disabled={busy||mutation.pending}><legend>Данные CV</legend>
 <Field label="Название CV" name="name" value={name} onChange={e=>setName(e.target.value)} maxLength={300} required/>
 <Field label="Ссылка на резюме HH" name="hh_url" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://hh.ru/resume/ID"/>
 <Field label="Файл CV (.txt / .md)" name="cv_file" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={event=>void file(event)}/>
 <Field label="Содержимое CV" name="content"><textarea id="content" name="content" value={content} onChange={e=>setContent(e.target.value)} required maxLength={200000} rows={12}/></Field>
 <Field label="Структурированные сведения (JSON)" name="structured"><textarea id="structured" name="structured" value={structured} onChange={e=>setStructured(e.target.value)} rows={6}/></Field><p className="hint">Необязательно: summary, skills, experience (role, details), education. Сведения вводятся явно; навыки не дописываются автоматически.</p>
 <button>Предпросмотр CV</button> <Link className="button secondary" to={cv?'/cvs/'+cv.id:'/cvs'}>Отмена</Link></fieldset>
 </form>{busy&&<p role="status">Подготовка предпросмотра… <button className="secondary" onClick={()=>{fileToken.current++;controller.current?.abort();setBusy(false);}}>Отменить предпросмотр</button></p>}
 {preview&&<section className="panel"><h2>Проверьте импорт</h2><h3>{preview.name}</h3><p>{preview.hh_url||'Ссылка HH не указана'} · {sourceKinds[preview.source.kind]} {preview.source.file_name||''}</p><p className="preserve cv-content">{preview.content}</p><pre>{JSON.stringify(preview.structured,null,2)}</pre>
 <label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Я проверил(а) содержимое и происхождение CV</label>
 <div className="actions"><button type="button" disabled={!confirmed||mutation.pending} onClick={save}>{mutation.pending?'Сохранение…':cv?'Сохранить новую версию':'Сохранить CV'}</button>{mutation.error&&<button className="secondary" disabled={mutation.pending} onClick={mutation.retry}>Повторить предыдущий запрос</button>}</div><p className="hint">Сопоставление не запускается при сохранении CV.</p>
 </section>}</section>;
}
export const cvRoutes=[
 {path:'cvs',loader:({request}:LoaderFunctionArgs)=>all<CV>('cvs',request.signal),Component:CVList},
 {path:'cvs/new',loader:()=>null,Component:CVImport},
 {path:'cvs/:id',loader:detailLoader,Component:CVDetail},
 {path:'cvs/:id/edit',loader:async(args:LoaderFunctionArgs)=>(await detailLoader(args)).cv,Component:CVImport},
 {path:'cvs/:id/revisions/:revisionId',loader:detailLoader,Component:CVDetail},
];
