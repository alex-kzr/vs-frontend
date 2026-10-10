import { clientUuid } from './identity';
import { SearchPreview } from './preview';
import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLoaderData, useLocation, useNavigate, useNavigation, useRouteError } from 'react-router';
import { ApiError, cleanFilters, toUtc } from './api';
import type { Company, Configuration, Contact, Conversation, Json, Message, Page, Vacancy } from './types';
import type { Entity, Resource, RouteData } from './routes';
import { names,resources } from './routes';
import { fieldLabel, lookupLabel, statusChoices, valueLabel } from './i18n';
import { External, Field, Problem, Refresh, SaveForm, Select,TextArea,Time,choices,localNow,nullable,text,statuses,useMutation,DraftGuard } from './ui';

export function Layout() {
 const navigation=useNavigation();
 return <div className="app"><aside><Link className="brand" to="/vacancies"><span className="brand-icon">V</span><span>Поиск<br/><b>вакансий</b></span></Link><p className="sidebar-label">РАБОЧАЯ ОБЛАСТЬ</p>
  <nav aria-label="Основное меню">{resources.map((resource,i)=><NavLink key={resource} to={'/'+resource}><span className="nav-number">0{i+1}</span>{names[resource]}</NavLink>)}</nav>
  <div className="local-note"><span className="dot"/> Локальная база SQLite<br/><small>Ручные записи · Только на этом компьютере</small></div></aside>
  <main><header className="topbar"><span>КАРЬЕРА / ДЕЙСТВИЯ</span><span>Личная рабочая область</span></header>
   {navigation.state!=='idle'&&<p role="status" className="loading">Загрузка / обновление…</p>}<Outlet/></main></div>;
}
export function RouteFailure() {
 const error=useRouteError();
 return <section className="page"><h1>{error instanceof ApiError&&error.status===404?'Запись не найдена':'Не удалось открыть страницу'}</h1>
  <Problem error={error instanceof ApiError?error.problem:{code:'load_failed',message:'Не удалось загрузить страницу. Повторите, когда сервер будет доступен.',fields:{}}}/>
  <button onClick={()=>location.reload()}>Повторить</button> <Link className="button secondary" to="/vacancies">Вакансии</Link></section>;
}
function label(entity:Entity) {return 'title' in entity?entity.title:'display_name' in entity?entity.display_name:'name' in entity?entity.name:entity.subject||'Переписка';}
function Pager({page}: {page:Page<unknown>}) {
 const location=useLocation();const navigate=useNavigate();const params=new URLSearchParams(location.search);
 if(page.next_cursor)params.set('cursor',page.next_cursor);
 return <div className="pager"><button className="secondary" onClick={()=>void navigate(-1)}>Назад</button>
  <span>{page.items.length} записей на этой странице</span>{page.next_cursor&&<Link className="button secondary" to={location.pathname+'?'+params}>Следующая страница →</Link>}</div>;
}
const filters:Record<Resource,readonly string[]>={
 vacancies:['q','status','company_id','source_id','search_configuration_id'],companies:['q'],contacts:['q','company_id'],conversations:['company_id','vacancy_id','channel_id'],'search-configurations':['enabled'],
};
export function ListScreen() {
 const d=useLoaderData<RouteData>();const page=d.page!;const location=useLocation();const navigate=useNavigate();const params=new URLSearchParams(location.search);
 function apply(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();const entries=new FormData(event.currentTarget);const search=cleanFilters(new URLSearchParams([...entries].map(([k,v])=>[k,String(v)])),filters[d.resource]);
  void navigate(location.pathname+(search.size?'?'+search:''));
 }
 const active=cleanFilters(params,filters[d.resource]).size>0;
 const vacancies=d.resource==='vacancies';
 return <section className={vacancies?'page vacancy-list':'page'}>
 {!vacancies&&<><div className="eyebrow">ПОИСК И ПЕРЕПИСКИ</div><div className="page-title"><div><h1>{names[d.resource]}</h1><p className="lede">{d.resource==='conversations'?'История переписок в хронологическом порядке.':'Профили поиска и связанные записи.'}</p></div><Link className="button" to={'/'+d.resource+'/new'}>+ {d.resource==='conversations'?'Записать переписку':'Создать запись'}</Link></div></>}
 <form className="filters" key={location.search} onSubmit={apply}>
  {filters[d.resource].includes('q')&&<Field label="Поиск" name="q" defaultValue={params.get('q')||''} maxLength={200} placeholder={d.resource==='vacancies'?'Поиск по названию…':'Поиск по имени…'}/>}
  {d.resource==='vacancies'&&<Select label="Статус" name="status" options={choices(statuses)} value={params.get('status')||''}/>}
  {filters[d.resource].includes('company_id')&&<Select label="Компания" name="company_id" options={d.companies.map(c=>({id:c.id,label:c.name}))} value={params.get('company_id')||''}/>}
  {d.resource==='vacancies'&&<><Select label="Источник" name="source_id" options={d.sources.map(s=>({id:s.id,label:lookupLabel(s)}))} value={params.get('source_id')||''}/><Select label="Профиль поиска" name="search_configuration_id" options={d.configs.map(c=>({id:c.id,label:c.name}))} value={params.get('search_configuration_id')||''}/></>}
  {d.resource==='search-configurations'&&<Select label="Включён" name="enabled" options={[{id:'true',label:'Включён'},{id:'false',label:'Выключен'}]} value={params.get('enabled')||''}/>}
  {d.resource==='conversations'&&<><Field label="ID вакансии" name="vacancy_id" defaultValue={params.get('vacancy_id')||''}/><Select label="Канал" name="channel_id" options={d.channels.map(c=>({id:c.id,label:lookupLabel(c)}))} value={params.get('channel_id')||''}/></>}
  <div className="filter-actions"><button className="secondary">Применить фильтры</button><Link to={'/'+d.resource}>Сбросить</Link><Refresh/></div>
 </form>
 <div className="list-heading">{vacancies?<h1>{active?'Отфильтрованные записи':'Все записи'}</h1>:<h2>{active?'Отфильтрованные записи':'Все записи'}</h2>}
  {vacancies?<div className="actions"><span className="subtle">По дате создания</span><Link className="button" to="/vacancies/new">+ Добавить вакансию</Link></div>:<span className="subtle">По дате создания</span>}</div>
 {page.items.length===0?<div className="empty"><div className="empty-symbol">↗</div><h2>{active?'Совпадений нет':'Пока нет записей'}</h2><p>{active?'Измените или сбросьте фильтры, чтобы увидеть записи.':'Добавьте первую запись. Она сохранится локально и останется доступна после перезапуска.'}</p><Link className="button secondary" to={active?'/'+d.resource:'/'+d.resource+'/new'}>{active?'Сбросить фильтры':'Создать первую запись'}</Link></div>:
 <div className="record-list">{page.items.map(entity=><Link className="record-row" to={'/'+d.resource+'/'+entity.id} key={entity.id}><div className="record-icon">{label(entity).slice(0,1).toUpperCase()}</div><div className="record-main"><h3>{label(entity)}</h3><p>{'company' in entity?entity.company.name:'company_id' in entity?d.companies.find(c=>c.id===entity.company_id)?.name||'Компания':'criteria' in entity?entity.criteria.keywords.join(' · ')||'Сохранённые критерии':'website' in entity?entity.website||'Запись компании':''}</p></div>
 <div className="record-meta">{'status' in entity?<><span className={'badge '+entity.status}>{valueLabel(entity.status)}</span><small>{entity.location||'Место не указано'} · {entity.work_format?valueLabel(entity.work_format):'Формат не указан'}</small><small>{entity.source_count} ссылок на источники</small></>:'enabled' in entity?<span className="badge">{entity.enabled?'включён':'выключен'}</span>:'roles' in entity?<small>{entity.roles.map(r=>lookupLabel(r)).join(' · ')||'Роли не указаны'}</small>:<Time value={entity.created_at}/>}</div><span className="row-arrow">→</span></Link>)}</div>}
 <Pager page={page}/>
 </section>;
}
export function DetailScreen() {
 const d=useLoaderData<RouteData>();const r=d.record!;
 return <section className="page"><Link className="backlink" to={'/'+d.resource}>← {names[d.resource]}</Link><div className="eyebrow">ДАННЫЕ ЗАПИСИ</div><div className="page-title"><h1>{label(r)}</h1><div className="actions"><Refresh/>{!['vacancies','conversations'].includes(d.resource)&&<Link className="button secondary" to={'/'+d.resource+'/'+r.id+'/edit'}>Редактировать</Link>}</div></div>
  {d.resource==='vacancies'?<VacancyDetail data={d} record={r as Vacancy}/>:d.resource==='conversations'?<ConversationDetail data={d} record={r as Conversation}/>:d.resource==='companies'?<CompanyDetail record={r as Company}/>:d.resource==='contacts'?<ContactDetail data={d} record={r as Contact}/>:<ConfigurationDetail record={r as Configuration}/>}
 </section>;
}
function CompanyDetail({record:r}: {record:Company}) {
 return <><div className="panel"><h2>Компания</h2><p><External url={r.website}/></p><p className="preserve">{r.notes||'Заметок нет'}</p></div><div className="related-links">
  <Link to={'/vacancies?company_id='+r.id}>Вакансии →</Link><Link to={'/contacts?company_id='+r.id}>Контакты →</Link><Link to={'/conversations?company_id='+r.id}>Переписки →</Link></div></>;
}
function ContactDetail({data,record:r}: {data:RouteData;record:Contact}) {
 return <div className="panel"><h2>{data.companies.find(c=>c.id===r.company_id)?.name}</h2><p>{r.email||'Почта не указана'}</p><p><External url={r.profile_url}/></p><div>{r.roles.map(role=><span className="badge" key={role.id}>{lookupLabel(role)}</span>)}</div><p className="preserve">{r.notes||'Заметок нет'}</p></div>;
}
function ConfigurationDetail({record:r}: {record:Configuration}) {
 return <><div className="panel"><h2>Сохранённые критерии поиска <span className="badge">{r.enabled?'включён':'выключен'}</span></h2><p className="hint">Сохранение критериев не запускает автоматический мониторинг.</p><dl><dt>Должность</dt><dd>{r.criteria.role||'Любые'}</dd>
  {(['keywords','excluded_keywords','locations','technologies','work_formats','employment_types'] as const).map(key=><div key={key}><dt>{fieldLabel(key)}</dt><dd>{r.criteria[key].map(value=>key==='work_formats'||key==='employment_types'?valueLabel(value):value).join(', ')||'Любые / не указаны'}</dd></div>)}{Boolean(r.criteria.queries?.length)&&<><dt>Запросы в браузере</dt><dd><ul>{r.criteria.queries?.map(query=>{const params=new URLSearchParams({text:query});if(r.criteria.work_formats.length===1&&r.criteria.work_formats[0]==='remote')params.set('work_format','REMOTE');return <li key={query}><a href={'https://hh.ru/search/vacancy?'+params} target="_blank" rel="noopener noreferrer">{query}</a></li>;})}</ul><p className="hint">Проверяйте условия полностью удалённой работы и ограничения по странам в описании вакансии. Результаты запросов могут пересекаться.</p></dd></>}{r.criteria.hh&&<><dt>Запрос HH</dt><dd>{r.criteria.hh.text||'Не настроено'}</dd><dt>Регионы HH</dt><dd>{r.criteria.hh.areas.map(a=>a.name).join(', ')||'Все регионы'}</dd><dt>Фильтры HH</dt><dd>{[...r.criteria.hh.experience,...r.criteria.hh.work_formats,...r.criteria.hh.employment_forms].map(valueLabel).join(', ')||'Любые'}</dd><dt>Записей на странице HH / период публикации</dt><dd>{r.criteria.hh.per_page} / {r.criteria.hh.period_days?r.criteria.hh.period_days+' дн.':'Любые'}</dd></>}</dl><Link to={'/vacancies?search_configuration_id='+r.id}>Связанные вакансии →</Link></div><SearchPreview key={JSON.stringify(r.criteria.hh)+r.id} configurationId={r.id} hh={r.criteria.hh}/></>;
}
function StatusPicker({value}: {value:string}) {
 return <fieldset id="status"><legend>Статус</legend>{statusChoices(value).map(option=><label className="check" key={option.id}><input type="radio" name="status" value={option.id} defaultChecked={option.id===value} required/> {option.label}</label>)}</fieldset>;
}
function VacancyDetail({data:d,record:r}: {data:RouteData;record:Vacancy}) {
 return <><div className="detail-grid"><div className="panel"><h2><Link to={'/companies/'+r.company_id}>{r.company.name}</Link></h2><span className={'badge '+r.status}>{valueLabel(r.status)}</span><dl><dt>Место / формат работы</dt><dd>{r.location||'Не указано'} / {valueLabel(r.work_format)}</dd><dt>Вид занятости</dt><dd>{valueLabel(r.employment_type)}</dd><dt>Зарплата (минимальные единицы валюты; период не указан)</dt><dd>{r.salary_min??'—'} – {r.salary_max??'—'} {r.salary_currency||''}</dd><dt>Первое обнаружение</dt><dd><Time value={r.first_seen_at}/></dd><dt>Последнее обнаружение</dt><dd><Time value={r.last_seen_at}/></dd><dt>Публичная ссылка</dt><dd><External url={r.public_url}/></dd></dl><p className="preserve">{r.description||'Описание не указано'}</p></div>
 <div className="panel"><h2>Ваше решение</h2><SaveForm path={'vacancies/'+r.id} method="PATCH" cancelTo="/vacancies" build={form=>({status:text(form,'status'),notes:nullable(form,'notes')})}>
 {r.status==='rejected'&&<p className="hint">Старый отказ сохранён без указания стороны. При изменении выберите «Я отказался» или «Работодатель отказал».</p>}<StatusPicker key={r.status} value={r.status}/><TextArea label="Заметки" name="notes" value={r.notes}/></SaveForm><Link to={'/conversations?vacancy_id='+r.id}>Связанные переписки →</Link></div></div>
 <div className="panel"><h2>История статусов</h2>
 {d.statusHistoryError?<p role="alert">{d.statusHistoryError}</p>:d.statusHistory?.length?<ol className="timeline">{d.statusHistory.map(change=><li className="source" key={change.id}><Time value={change.changed_at}/><p>{valueLabel(change.previous_status)} → {valueLabel(change.status)}</p></li>)}</ol>:<p className="hint">Изменений статуса пока нет. История ведётся с этой версии; прежние изменения не восстанавливаются автоматически.</p>}
 </div>
 <div className="panel"><h2>Ссылки на источники <span className="count">{r.source_count}</span></h2>{r.source_references?.map(ref=><article className="source" key={ref.id}><strong>{lookupLabel(d.sources.find(s=>s.id===ref.source_id))}</strong><p>ID в источнике: <code>{ref.external_vacancy_id||'Не указано'}</code></p><p><External url={ref.external_url}/></p><small>{ref.link_basis==='explicit'?'Связано вручную':'Первоначальный источник'} · <Time value={ref.first_seen_at}/> — <Time value={ref.last_seen_at}/></small></article>)}
 <details><summary>Связать ещё один источник с вакансией</summary><p>При добавлении источника укажите этот ID в поле целевой вакансии: <code>{r.id}</code></p><Link to="/vacancies/new">Записать ещё одно обнаружение →</Link></details></div>
 <div className="panel"><h2>История обнаружений</h2>{d.panelError?<p role="alert">{d.panelError}</p>:d.discoveries&&<>{d.discoveries.items.map(item=><article className="source" key={item.id}><Time value={item.observed_at}/><p>{item.criteria_snapshot?'Критерии при обнаружении: '+(item.criteria_snapshot.criteria.keywords.join(', ')||item.criteria_snapshot.criteria.role||'Сохранённый профиль'):'Ручное обнаружение без профиля поиска'}</p><details><summary>Данные обнаружения (оригинал)</summary><pre>{JSON.stringify(item.normalized_payload,null,2)}</pre></details>{Boolean(item.source_payload)&&<details><summary>{item.source_payload&&typeof item.source_payload==='object'&&!Array.isArray(item.source_payload)&&item.source_payload.provider==='hh-browser'?'Данные просмотра HH в браузере':'Исходные данные HH'}</summary><p>{item.source_payload&&typeof item.source_payload==='object'&&!Array.isArray(item.source_payload)&&item.source_payload.provider==='hh-browser'?'Публичные данные вакансии и оценка при просмотре в браузере по поручению пользователя. Возможность работы из вашей страны уточните у работодателя.':'Фрагмент поисковой выдачи, исходная зарплата, сведения о налогах и запрос на момент получения.'}</p><pre>{JSON.stringify(item.source_payload,null,2)}</pre></details>}</article>)}<Pager page={d.discoveries}/></>}</div></>;
}
function ConversationDetail({data:d,record:r}: {data:RouteData;record:Conversation}) {
 const participants=r.participants||[];
 return <><div className="panel"><div className="page-title"><div><h2>{d.companies.find(c=>c.id===r.company_id)?.name}</h2><p>{lookupLabel(d.channels.find(c=>c.id===r.channel_id))}</p></div>{r.vacancy_id&&<Link to={'/vacancies/'+r.vacancy_id}>Связанная вакансия →</Link>}</div>
 <div className="participants">{participants.map(p=><span className="badge" key={p.id}>{p.display_name} · {valueLabel(p.participant_kind)}</span>)}</div>
 <details><summary>Добавить участника</summary><ParticipantForm key={participants.length} data={d} record={r}/></details></div>
 <div className="detail-grid"><div className="panel"><h2>История переписки</h2><p className="hint">Только записи уже состоявшихся сообщений. Приложение ничего не отправляет.</p>
 {d.panelError?<p role="alert">{d.panelError}</p>:d.messages&&<>{d.messages.items.length===0&&<p className="empty-inline">Сообщений пока нет.</p>}
 <ol className="timeline">{d.messages.items.map(m=><MessageItem key={m.id} message={m} sender={participants.find(p=>p.id===m.sender_participant_id)?.display_name||'Неизвестный участник'}/>)}</ol><Pager page={d.messages}/></>}</div>
 <div className="panel"><h2>Записать сообщение</h2><MessageComposer key={r.id} conversation={r}/></div></div></>;
}
function MessageItem({message:m,sender}: {message:Message;sender:string}) {
 return <li className={'message '+m.direction}><div><strong>{sender}</strong><span className="badge">{valueLabel(m.direction)}</span></div><p className="preserve">{m.body}</p><Time value={m.occurred_at}/></li>;
}
function MessageComposer({conversation}: {conversation:Conversation}) {
 const mutation=useMutation();const [dirty,setDirty]=useState(false);const [direction,setDirection]=useState('outbound');const [clientId,setClientId]=useState(()=>clientUuid());
 const participants=(conversation.participants||[]).filter(p=>(p.participant_kind==='user')===(direction==='outbound'));
 const success=mutation.result?.ok===true;
 function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();const f=new FormData(event.currentTarget);
  mutation.submit('conversations/'+conversation.id+'/messages','POST',{direction,sender_participant_id:text(f,'sender_participant_id'),body:String(f.get('body')||''),occurred_at:toUtc(text(f,'occurred_at')),client_message_id:clientId,external_message_id:nullable(f,'external_message_id')});
 }
 if(success)return <div role="status"><p>Сообщение сохранено в SQLite.</p><button onClick={()=>{mutation.reset();setClientId(clientUuid());setDirty(false);}}>Записать ещё сообщение</button></div>;
 return <><DraftGuard dirty={dirty}/><form onSubmit={submit} onChange={()=>setDirty(true)}><Problem error={mutation.error}/>
  <Select label="Направление" name="direction" options={choices(['outbound','inbound'])} value={direction} required onChange={setDirection}/>
  <Select key={direction+participants.length} label="Отправитель" name="sender_participant_id" options={participants.map(p=>({id:p.id,label:p.display_name}))} value={participants[0]?.id} required/>
  <TextArea label="Текст сообщения" name="body" max={100000} required/><Field label="Дата сообщения (местное время)" name="occurred_at" type="datetime-local" step="0.001" defaultValue={localNow()} required/>
  <Field label="ID сообщения в источнике (необязательно)" name="external_message_id" maxLength={500}/>
  <button disabled={mutation.pending}>{mutation.pending?'Сохранение…':'Записать сообщение'}</button>
  {mutation.error&&<button type="button" className="secondary" disabled={mutation.pending} onClick={mutation.retry}>Повторить предыдущий запрос</button>}
 </form></>;
}
function ParticipantForm({data:d,record:r}: {data:RouteData;record:Conversation}) {
 const [kind,setKind]=useState('unknown');const [key]=useState(()=>clientUuid());
 return <SaveForm path={'conversations/'+r.id+'/participants'} cancelTo={'/conversations/'+r.id} build={form=>({participant_key:key,participant_kind:kind,contact_id:kind==='contact'?text(form,'contact_id'):null,display_name:kind==='contact'?null:text(form,'display_name')}) as Json}>
  <Select label="Тип участника" name="participant_kind" options={choices(['unknown','contact','user'])} value={kind} required onChange={setKind}/>
  {kind==='contact'?<Select label="Контакт" name="contact_id" options={d.contacts.filter(c=>c.company_id===r.company_id).map(c=>({id:c.id,label:c.display_name}))} required/>:<Field label="Имя участника" name="display_name" required maxLength={300}/>}
 </SaveForm>;
}
