import { SearchPreview } from './preview';
import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLoaderData, useLocation, useNavigate, useNavigation, useRouteError } from 'react-router';
import { ApiError, cleanFilters, toUtc } from './api';
import type { Company, Configuration, Contact, Conversation, Json, Message, Page, Vacancy } from './types';
import type { Entity, Resource, RouteData } from './routes';
import { names,resources } from './routes';
import { External, Field, Problem, Refresh, SaveForm, Select,TextArea,Time,choices,localNow,nullable,text,statuses,useMutation,DraftGuard } from './ui';

export function Layout() {
 const navigation=useNavigation();
 return <div className="app"><aside><Link className="brand" to="/vacancies"><span className="brand-icon">V</span><span>Vacancy<br/><b>Search</b></span></Link><p className="sidebar-label">YOUR WORKSPACE</p>
  <nav aria-label="Main navigation">{resources.map((resource,i)=><NavLink key={resource} to={'/'+resource}><span className="nav-number">0{i+1}</span>{names[resource]}</NavLink>)}</nav>
  <div className="local-note"><span className="dot"/> Local SQLite workspace<br/><small>Manual records · Private on this computer</small></div></aside>
  <main><header className="topbar"><span>CAREER / ACTIVITY</span><span>Personal workspace</span></header>
   {navigation.state!=='idle'&&<p role="status" className="loading">Loading / updating…</p>}<Outlet/></main></div>;
}
export function RouteFailure() {
 const error=useRouteError();
 return <section className="page"><h1>{error instanceof ApiError&&error.status===404?'Record not found':'Unable to load this view'}</h1>
  <Problem error={error instanceof ApiError?error.problem:{code:'load_failed',message:'The view could not be loaded. Retry when the backend is available.',fields:{}}}/>
  <button onClick={()=>location.reload()}>Retry</button> <Link className="button secondary" to="/vacancies">Vacancies</Link></section>;
}
function label(entity:Entity) {return 'title' in entity?entity.title:'display_name' in entity?entity.display_name:'name' in entity?entity.name:entity.subject||'Conversation';}
function Pager({page}: {page:Page<unknown>}) {
 const location=useLocation();const navigate=useNavigate();const params=new URLSearchParams(location.search);
 if(page.next_cursor)params.set('cursor',page.next_cursor);
 return <div className="pager"><button className="secondary" onClick={()=>void navigate(-1)}>Back</button>
  <span>{page.items.length} records on this page</span>{page.next_cursor&&<Link className="button secondary" to={location.pathname+'?'+params}>Next page →</Link>}</div>;
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
 return <section className="page"><div className="eyebrow">YOUR CAREER, IN CONTEXT</div><div className="page-title"><div><h1>{names[d.resource]}</h1><p className="lede">{d.resource==='vacancies'?'A clear view of every opportunity and where you found it.':d.resource==='conversations'?'A chronological record of the conversations that matter.':'Keep your search and relationships organized.'}</p></div><Link className="button" to={'/'+d.resource+'/new'}>+ {d.resource==='vacancies'?'Add vacancy':d.resource==='conversations'?'Record conversation':'Create record'}</Link></div>
 <form className="filters" key={location.search} onSubmit={apply}>
  {filters[d.resource].includes('q')&&<Field label="Search" name="q" defaultValue={params.get('q')||''} maxLength={200} placeholder={d.resource==='vacancies'?'Search title…':'Search name…'}/>}
  {d.resource==='vacancies'&&<Select label="Status" name="status" options={choices(statuses)} value={params.get('status')||''}/>}
  {filters[d.resource].includes('company_id')&&<Select label="Company" name="company_id" options={d.companies.map(c=>({id:c.id,label:c.name}))} value={params.get('company_id')||''}/>}
  {d.resource==='vacancies'&&<><Select label="Source" name="source_id" options={d.sources.map(s=>({id:s.id,label:s.name||s.code}))} value={params.get('source_id')||''}/><Select label="Configuration" name="search_configuration_id" options={d.configs.map(c=>({id:c.id,label:c.name}))} value={params.get('search_configuration_id')||''}/></>}
  {d.resource==='search-configurations'&&<Select label="Enabled" name="enabled" options={[{id:'true',label:'Enabled'},{id:'false',label:'Disabled'}]} value={params.get('enabled')||''}/>}
  {d.resource==='conversations'&&<><Field label="Vacancy ID" name="vacancy_id" defaultValue={params.get('vacancy_id')||''}/><Select label="Channel" name="channel_id" options={d.channels.map(c=>({id:c.id,label:c.label||c.code}))} value={params.get('channel_id')||''}/></>}
  <div className="filter-actions"><button className="secondary">Apply filters</button><Link to={'/'+d.resource}>Clear</Link><Refresh/></div>
 </form>
 <div className="list-heading"><h2>{active?'Filtered records':'All records'}</h2><span className="subtle">Sorted by creation date</span></div>
 {page.items.length===0?<div className="empty"><div className="empty-symbol">↗</div><h2>{active?'No matching records':'Your workspace starts here'}</h2><p>{active?'Adjust or clear the filters to see more records.':'Add your first record. It will be saved locally and remain available after restart.'}</p><Link className="button secondary" to={active?'/'+d.resource:'/'+d.resource+'/new'}>{active?'Clear filters':'Create first record'}</Link></div>:
 <div className="record-list">{page.items.map(entity=><Link className="record-row" to={'/'+d.resource+'/'+entity.id} key={entity.id}><div className="record-icon">{label(entity).slice(0,1).toUpperCase()}</div><div className="record-main"><h3>{label(entity)}</h3><p>{'company' in entity?entity.company.name:'company_id' in entity?d.companies.find(c=>c.id===entity.company_id)?.name||'Company':'criteria' in entity?entity.criteria.keywords.join(' · ')||'Saved preferences':'website' in entity?entity.website||'Company record':''}</p></div>
 <div className="record-meta">{'status' in entity?<><span className={'badge '+entity.status}>{entity.status}</span><small>{entity.location||'Location not provided'} · {entity.work_format||'Format not provided'}</small><small>{entity.source_count} source references</small></>:'enabled' in entity?<span className="badge">{entity.enabled?'enabled':'disabled'}</span>:'roles' in entity?<small>{entity.roles.map(r=>r.label).join(' · ')||'No roles'}</small>:<Time value={entity.created_at}/>}</div><span className="row-arrow">→</span></Link>)}</div>}
 <Pager page={page}/>
 </section>;
}
export function DetailScreen() {
 const d=useLoaderData<RouteData>();const r=d.record!;
 return <section className="page"><Link className="backlink" to={'/'+d.resource}>← {names[d.resource]}</Link><div className="eyebrow">RECORD DETAILS</div><div className="page-title"><h1>{label(r)}</h1><div className="actions"><Refresh/>{!['vacancies','conversations'].includes(d.resource)&&<Link className="button secondary" to={'/'+d.resource+'/'+r.id+'/edit'}>Edit record</Link>}</div></div>
  {d.resource==='vacancies'?<VacancyDetail data={d} record={r as Vacancy}/>:d.resource==='conversations'?<ConversationDetail data={d} record={r as Conversation}/>:d.resource==='companies'?<CompanyDetail record={r as Company}/>:d.resource==='contacts'?<ContactDetail data={d} record={r as Contact}/>:<ConfigurationDetail record={r as Configuration}/>}
 </section>;
}
function CompanyDetail({record:r}: {record:Company}) {
 return <><div className="panel"><h2>Company</h2><p><External url={r.website}/></p><p className="preserve">{r.notes||'No notes'}</p></div><div className="related-links">
  <Link to={'/vacancies?company_id='+r.id}>View vacancies →</Link><Link to={'/contacts?company_id='+r.id}>View contacts →</Link><Link to={'/conversations?company_id='+r.id}>View conversations →</Link></div></>;
}
function ContactDetail({data,record:r}: {data:RouteData;record:Contact}) {
 return <div className="panel"><h2>{data.companies.find(c=>c.id===r.company_id)?.name}</h2><p>{r.email||'Email not provided'}</p><p><External url={r.profile_url}/></p><div>{r.roles.map(role=><span className="badge" key={role.id}>{role.label}</span>)}</div><p className="preserve">{r.notes||'No notes'}</p></div>;
}
function ConfigurationDetail({record:r}: {record:Configuration}) {
 return <><div className="panel"><h2>Saved search preferences <span className="badge">{r.enabled?'enabled':'disabled'}</span></h2><p className="hint">Saved preferences do not start automated monitoring.</p><dl><dt>Role</dt><dd>{r.criteria.role||'Any'}</dd>
  {(['keywords','excluded_keywords','locations','technologies','work_formats','employment_types'] as const).map(key=><div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{r.criteria[key].join(', ')||'Any / none specified'}</dd></div>)}</dl><Link to={'/vacancies?search_configuration_id='+r.id}>View associated discoveries →</Link></div><SearchPreview configurationId={r.id}/></>;
}
function VacancyDetail({data:d,record:r}: {data:RouteData;record:Vacancy}) {
 return <><div className="detail-grid"><div className="panel"><h2><Link to={'/companies/'+r.company_id}>{r.company.name}</Link></h2><span className={'badge '+r.status}>{r.status}</span><dl><dt>Location / work format</dt><dd>{r.location||'Not provided'} / {r.work_format||'Not provided'}</dd><dt>Employment</dt><dd>{r.employment_type||'Not provided'}</dd><dt>Salary (minor units; period unspecified)</dt><dd>{r.salary_min??'—'} – {r.salary_max??'—'} {r.salary_currency||''}</dd><dt>First observed</dt><dd><Time value={r.first_seen_at}/></dd><dt>Last observed</dt><dd><Time value={r.last_seen_at}/></dd><dt>Public link</dt><dd><External url={r.public_url}/></dd></dl><p className="preserve">{r.description||'Description not provided'}</p></div>
 <div className="panel"><h2>Your review</h2><SaveForm path={'vacancies/'+r.id} method="PATCH" cancelTo="/vacancies" build={form=>({status:text(form,'status'),notes:nullable(form,'notes')})}>
 <Select key={r.status} label="Status" name="status" options={choices(statuses)} value={r.status} required/><TextArea label="Notes" name="notes" value={r.notes}/></SaveForm><Link to={'/conversations?vacancy_id='+r.id}>Related conversations →</Link></div></div>
 <div className="panel"><h2>Source references <span className="count">{r.source_count}</span></h2>{r.source_references?.map(ref=><article className="source" key={ref.id}><strong>{d.sources.find(s=>s.id===ref.source_id)?.name||'Source'}</strong><p>External ID: <code>{ref.external_vacancy_id||'Not provided'}</code></p><p><External url={ref.external_url}/></p><small>{ref.link_basis==='explicit'?'Explicitly linked':'Original reference'} · <Time value={ref.first_seen_at}/> — <Time value={ref.last_seen_at}/></small></article>)}
 <details><summary>Link another source to this vacancy</summary><p>Copy this vacancy ID into the explicit target field when adding another reference: <code>{r.id}</code></p><Link to="/vacancies/new">Record another observation →</Link></details></div>
 <div className="panel"><h2>Discovery history</h2>{d.panelError?<p role="alert">{d.panelError}</p>:d.discoveries&&<>{d.discoveries.items.map(item=><article className="source" key={item.id}><Time value={item.observed_at}/><p>{item.criteria_snapshot?'Criteria at observation: '+(item.criteria_snapshot.criteria.keywords.join(', ')||item.criteria_snapshot.criteria.role||'Saved configuration'):'Manual observation, no search configuration'}</p><details><summary>Observation fields</summary><pre>{JSON.stringify(item.normalized_payload,null,2)}</pre></details></article>)}<Pager page={d.discoveries}/></>}</div></>;
}
function ConversationDetail({data:d,record:r}: {data:RouteData;record:Conversation}) {
 const participants=r.participants||[];
 return <><div className="panel"><div className="page-title"><div><h2>{d.companies.find(c=>c.id===r.company_id)?.name}</h2><p>{d.channels.find(c=>c.id===r.channel_id)?.label||'Manual channel'}</p></div>{r.vacancy_id&&<Link to={'/vacancies/'+r.vacancy_id}>Related vacancy →</Link>}</div>
 <div className="participants">{participants.map(p=><span className="badge" key={p.id}>{p.display_name} · {p.participant_kind}</span>)}</div>
 <details><summary>Add a participant</summary><ParticipantForm key={participants.length} data={d} record={r}/></details></div>
 <div className="detail-grid"><div className="panel"><h2>Conversation history</h2><p className="hint">Recorded messages only. Nothing is sent from this application.</p>
 {d.panelError?<p role="alert">{d.panelError}</p>:d.messages&&<>{d.messages.items.length===0&&<p className="empty-inline">No messages recorded yet.</p>}
 <ol className="timeline">{d.messages.items.map(m=><MessageItem key={m.id} message={m} sender={participants.find(p=>p.id===m.sender_participant_id)?.display_name||'Unknown participant'}/>)}</ol><Pager page={d.messages}/></>}</div>
 <div className="panel"><h2>Record a message</h2><MessageComposer key={r.id} conversation={r}/></div></div></>;
}
function MessageItem({message:m,sender}: {message:Message;sender:string}) {
 return <li className={'message '+m.direction}><div><strong>{sender}</strong><span className="badge">{m.direction}</span></div><p className="preserve">{m.body}</p><Time value={m.occurred_at}/></li>;
}
function MessageComposer({conversation}: {conversation:Conversation}) {
 const mutation=useMutation();const [dirty,setDirty]=useState(false);const [direction,setDirection]=useState('outbound');const [clientId,setClientId]=useState(()=>crypto.randomUUID());
 const participants=(conversation.participants||[]).filter(p=>(p.participant_kind==='user')===(direction==='outbound'));
 const success=mutation.result?.ok===true;
 function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();const f=new FormData(event.currentTarget);
  mutation.submit('conversations/'+conversation.id+'/messages','POST',{direction,sender_participant_id:text(f,'sender_participant_id'),body:String(f.get('body')||''),occurred_at:toUtc(text(f,'occurred_at')),client_message_id:clientId,external_message_id:nullable(f,'external_message_id')});
 }
 if(success)return <div role="status"><p>Message saved to SQLite.</p><button onClick={()=>{mutation.reset();setClientId(crypto.randomUUID());setDirty(false);}}>Record another message</button></div>;
 return <><DraftGuard dirty={dirty}/><form onSubmit={submit} onChange={()=>setDirty(true)}><Problem error={mutation.error}/>
  <Select label="Direction" name="direction" options={choices(['outbound','inbound'])} value={direction} required onChange={setDirection}/>
  <Select key={direction+participants.length} label="Sender" name="sender_participant_id" options={participants.map(p=>({id:p.id,label:p.display_name}))} value={participants[0]?.id} required/>
  <TextArea label="Message text" name="body" max={100000} required/><Field label="Occurred at (local time)" name="occurred_at" type="datetime-local" step="0.001" defaultValue={localNow()} required/>
  <Field label="External message ID (optional)" name="external_message_id" maxLength={500}/>
  <button disabled={mutation.pending}>{mutation.pending?'Saving…':'Record message'}</button>
  {mutation.error&&<button type="button" className="secondary" disabled={mutation.pending} onClick={mutation.retry}>Retry previous submission</button>}
 </form></>;
}
function ParticipantForm({data:d,record:r}: {data:RouteData;record:Conversation}) {
 const [kind,setKind]=useState('unknown');const [key]=useState(()=>crypto.randomUUID());
 return <SaveForm path={'conversations/'+r.id+'/participants'} cancelTo={'/conversations/'+r.id} build={form=>({participant_key:key,participant_kind:kind,contact_id:kind==='contact'?text(form,'contact_id'):null,display_name:kind==='contact'?null:text(form,'display_name')}) as Json}>
  <Select label="Participant kind" name="participant_kind" options={choices(['unknown','contact','user'])} value={kind} required onChange={setKind}/>
  {kind==='contact'?<Select label="Contact" name="contact_id" options={d.contacts.filter(c=>c.company_id===r.company_id).map(c=>({id:c.id,label:c.display_name}))} required/>:<Field label="Participant name" name="display_name" required maxLength={300}/>}
 </SaveForm>;
}
