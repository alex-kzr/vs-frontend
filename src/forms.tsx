import { useState } from 'react';
import { Link, useLoaderData } from 'react-router';
import { toUtc } from './api';
import type { Company, Configuration, Contact, Json } from './types';
import type { RouteData } from './routes';
import { names } from './routes';
import { Field, Select, TextArea, SaveForm, choices,formats,employment,localNow,text,nullable,csv } from './ui';

export function EntryScreen() {
 const data=useLoaderData<RouteData>();const {resource,record}=data;
 return <section className="page"><div className="eyebrow">LOCAL WORKSPACE</div><h1>{record?'Edit':'New'} {names[resource].toLowerCase().replace(/ies$/,'y').replace(/s$/,'')}</h1>
  <p className="lede">{resource==='vacancies'?'Record a vacancy you discovered. Existing source identities preserve one vacancy and add observation history.':resource==='conversations'?'Record communication that happened outside this application.':''}</p>
  <EntryForm key={resource+(record?.id||'new')} data={data}/>
 </section>;
}
function EntryForm({data}: {data:RouteData}) {
 const {resource,record,companies,roles,configs,sources,channels,contacts,vacancies}=data;
 const companyDefault=record&&'company_id' in record?record.company_id:'';
 const [companyId,setCompanyId]=useState(companyDefault);
 const [participantKind,setParticipantKind]=useState('unknown');
 const [ids]=useState(()=>({external:crypto.randomUUID(),observation:crypto.randomUUID()}));
 const config=resource==='search-configurations'?record as Configuration|undefined:undefined;
 const company=resource==='companies'?record as Company|undefined:undefined;
 const contact=resource==='contacts'?record as Contact|undefined:undefined;
 const companyChoices=companies.map(c=>({id:c.id,label:c.name}));
 function build(form:FormData):Json {
  if(resource==='companies')return {name:text(form,'name'),website:nullable(form,'website'),notes:nullable(form,'notes')};
  if(resource==='search-configurations')return {name:text(form,'name'),criteria_version:1,enabled:form.get('enabled')==='on',criteria:{
   role:nullable(form,'role'),keywords:csv(form,'keywords'),excluded_keywords:csv(form,'excluded_keywords'),locations:csv(form,'locations'),technologies:csv(form,'technologies'),
   work_formats:form.getAll('work_formats').map(String),employment_types:form.getAll('employment_types').map(String),
  }};
  if(resource==='contacts')return {
   ...(record?{}:{company_id:text(form,'company_id')}),display_name:text(form,'display_name'),email:nullable(form,'email'),
   profile_url:nullable(form,'profile_url'),notes:nullable(form,'notes'),role_ids:form.getAll('role_ids').map(String),
  };
  if(resource==='vacancies') {
   const number=(key:string)=>{const raw=text(form,key);if(!raw)return null;const n=Number(raw);if(!Number.isSafeInteger(n)||n<0)throw new Error('Salary must be a non-negative safe integer in minor units.');return n;};
   return {source_id:text(form,'source_id'),external_vacancy_id:nullable(form,'external_vacancy_id'),external_url:nullable(form,'external_url'),target_vacancy_id:nullable(form,'target_vacancy_id'),
    vacancy:{company_id:text(form,'company_id'),title:text(form,'title'),description:nullable(form,'description'),location:nullable(form,'location'),work_format:nullable(form,'work_format'),
     employment_type:nullable(form,'employment_type'),salary_min:number('salary_min'),salary_max:number('salary_max'),salary_currency:nullable(form,'salary_currency'),public_url:nullable(form,'public_url')},
    observation:{observation_key:ids.observation,observed_at:toUtc(text(form,'observed_at')),search_configuration_id:nullable(form,'search_configuration_id')}};
  }
  return {company_id:text(form,'company_id'),vacancy_id:nullable(form,'vacancy_id'),channel_id:text(form,'channel_id'),subject:nullable(form,'subject'),external_conversation_id:nullable(form,'external_conversation_id'),
   participants:[{participant_key:'self',participant_kind:'user',display_name:'Me'},participantKind==='contact'?
    {participant_key:'contact-'+text(form,'contact_id'),participant_kind:'contact',contact_id:text(form,'contact_id')}:
    {participant_key:'other',participant_kind:'unknown',display_name:text(form,'participant_label')}]};
 }
 const path=resource==='vacancies'?'vacancy-source-references':resource+(record?'/'+record.id:'');
 return <SaveForm path={path} method={record?'PATCH':'POST'} build={build} cancelTo={'/'+resource} redirectTo={result=>'/'+resource+'/'+(resource==='vacancies'?result.vacancy_id:result.id)}>
  {resource==='companies'&&<><Field label="Company name" name="name" defaultValue={company?.name} maxLength={300} required/><Field label="Website" name="website" type="url" defaultValue={company?.website||''} maxLength={2048}/><TextArea label="Notes" name="notes" value={company?.notes}/></>}
  {resource==='search-configurations'&&<>
   <Field label="Configuration name" name="name" defaultValue={config?.name} required maxLength={200}/>
   <label className="check"><input type="checkbox" name="enabled" defaultChecked={config?.enabled??true}/> Enabled for manual selection</label>
   <p className="hint">These preferences are saved locally. No scheduled monitoring starts.</p>
   <Field label="Role" name="role" defaultValue={config?.criteria.role||''} maxLength={500}/>
   {(['keywords','excluded_keywords','locations','technologies'] as const).map(key=><Field key={key} label={key.replaceAll('_',' ')+' (comma separated)'} name={key} defaultValue={config?.criteria[key].join(', ')||''}/>)}
   <fieldset><legend>Work formats</legend>{formats.map(value=><label key={value} className="check"><input type="checkbox" name="work_formats" value={value} defaultChecked={config?.criteria.work_formats.includes(value)}/> {value}</label>)}</fieldset>
   <fieldset><legend>Employment types</legend>{employment.map(value=><label key={value} className="check"><input type="checkbox" name="employment_types" value={value} defaultChecked={config?.criteria.employment_types.includes(value)}/> {value.replaceAll('_',' ')}</label>)}</fieldset>
  </>}
  {['contacts','vacancies','conversations'].includes(resource)&&(!record?<><Select label="Company" name="company_id" options={companyChoices} required onChange={setCompanyId}/>{companies.length===0&&<p><Link to="/companies/new">Create a company first</Link></p>}</>:<p>Company: {companies.find(c=>c.id===companyDefault)?.name||companyDefault}</p>)}
  {resource==='contacts'&&<>
   <Field label="Contact name" name="display_name" defaultValue={contact?.display_name} maxLength={300} required/>
   <Field label="Email" name="email" type="email" defaultValue={contact?.email||''} maxLength={320}/>
   <Field label="Profile URL" name="profile_url" type="url" defaultValue={contact?.profile_url||''} maxLength={2048}/>
   <fieldset><legend>Roles</legend>{roles.map(role=><label className="check" key={role.id}><input type="checkbox" name="role_ids" value={role.id} defaultChecked={contact?.role_ids.includes(role.id)}/> {role.label}</label>)}</fieldset>
   <TextArea label="Notes" name="notes" value={contact?.notes}/>
  </>}
  {resource==='vacancies'&&<>
   <div className="form-grid"><Field label="Title" name="title" required maxLength={500}/><Field label="Location" name="location" maxLength={500}/></div>
   <div className="form-grid"><Select label="Work format" name="work_format" options={choices(formats)}/><Select label="Employment type" name="employment_type" options={choices(employment)}/></div>
   <TextArea label="Description" name="description" max={100000}/>
   <div className="form-grid"><Field label="Salary minimum (minor units)" name="salary_min" type="number" min={0} step={1}/><Field label="Salary maximum (minor units)" name="salary_max" type="number" min={0} step={1}/><Field label="Currency (e.g. USD)" name="salary_currency" maxLength={3} pattern="[A-Z]{3}"/></div>
   <p className="hint">Salary period is unspecified; salary comparisons are unavailable.</p>
   <Field label="Public vacancy URL" name="public_url" type="url" maxLength={2048}/>
   <fieldset><legend>Source and observation</legend>
    <Select label="Source" name="source_id" options={sources.map(s=>({id:s.id,label:s.name||s.code}))} value={sources.find(s=>s.code==='manual')?.id} required/>
    <Field label="External vacancy ID" name="external_vacancy_id" defaultValue={ids.external} maxLength={500}/>
    <Field label="Source URL" name="external_url" type="url" maxLength={2048}/>
    <p className="hint">Keep this source ID when recording the same vacancy again. At least one source ID or URL is required.</p>
    <Field label="Observed at (local time)" name="observed_at" type="datetime-local" defaultValue={localNow()} step="0.001" required/>
    <Select label="Search configuration" name="search_configuration_id" options={configs.map(c=>({id:c.id,label:c.name+(c.enabled?'':' (disabled)')}))}/>
    <Field label="Explicit target vacancy ID (optional)" name="target_vacancy_id" maxLength={100}/>
    <p className="hint">Use a known vacancy ID to explicitly attach another source reference at the same company.</p>
   </fieldset>
  </>}
  {resource==='conversations'&&<>
   <Field label="Subject" name="subject" maxLength={500}/>
   <Select key={'vacancy'+companyId} label="Related vacancy" name="vacancy_id" options={vacancies.filter(v=>v.company_id===companyId).map(v=>({id:v.id,label:v.title}))}/>
   <Select label="Channel" name="channel_id" options={channels.map(c=>({id:c.id,label:c.label||c.code}))} value={channels.find(c=>c.code==='manual')?.id} required/>
   <Field label="External conversation ID (optional)" name="external_conversation_id" maxLength={500}/>
   <fieldset><legend>Participants</legend><p>You are included as “Me”. Add the person you communicated with.</p>
    <Select label="Other participant" name="participant_kind" options={[{id:'unknown',label:'Named person (no contact record)'},{id:'contact',label:'Existing company contact'}]} value={participantKind} required onChange={setParticipantKind}/>
    {participantKind==='contact'?<Select key={'contact'+companyId} label="Contact" name="contact_id" options={contacts.filter(c=>c.company_id===companyId).map(c=>({id:c.id,label:c.display_name}))} required/>:<Field label="Participant name" name="participant_label" required maxLength={300}/>}
   </fieldset>
  </>}
 </SaveForm>;
}
