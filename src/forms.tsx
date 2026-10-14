import { clientUuid } from './identity';
import { HhCriteriaFields } from './hh-form';
import { useState } from 'react';
import { Link, useLoaderData } from 'react-router';
import { toUtc } from './api';
import type { Company, Configuration, Contact, Json } from './types';
import type { RouteData } from './routes';
import { fieldLabel, lookupLabel, valueLabel } from './i18n';
import { Field, Select, TextArea, SaveForm, choices,formats,employment,localNow,text,nullable,csv } from './ui';

export function EntryScreen() {
 const data=useLoaderData<RouteData>();const {resource,record}=data;
 return <section className="page"><div className="eyebrow">ЛОКАЛЬНЫЕ ЗАПИСИ</div><h1>{{vacancies:['Новая вакансия','Изменить вакансию'],'search-configurations':['Новый профиль поиска','Изменить профиль поиска'],companies:['Новая компания','Изменить компанию'],contacts:['Новый контакт','Изменить контакт'],conversations:['Новая переписка','Изменить переписку']}[resource][record?1:0]}</h1>
  <p className="lede">{resource==='vacancies'?'Запишите найденную вакансию. Повторный источник сохранит одну вакансию и добавит обнаружение в историю.':resource==='conversations'?'Запишите переписку, состоявшуюся вне приложения.':''}</p>
  <EntryForm key={resource+(record?.id||'new')} data={data}/>
 </section>;
}
function EntryForm({data}: {data:RouteData}) {
 const {resource,record,companies,roles,configs,sources,channels,contacts,vacancies}=data;
 const companyDefault=record&&'company_id' in record?record.company_id:'';
 const [companyId,setCompanyId]=useState(companyDefault);
 const [participantKind,setParticipantKind]=useState('unknown');
 const [ids]=useState(()=>({external:clientUuid(),observation:clientUuid()}));
 const config=resource==='search-configurations'?record as Configuration|undefined:undefined;
 const company=resource==='companies'?record as Company|undefined:undefined;
 const contact=resource==='contacts'?record as Contact|undefined:undefined;
 const companyChoices=companies.map(c=>({id:c.id,label:c.name}));
 function build(form:FormData):Json {
  if(resource==='companies')return {name:text(form,'name'),website:nullable(form,'website'),notes:nullable(form,'notes')};
  if(resource==='search-configurations') {
   const criteria={role:nullable(form,'role'),keywords:csv(form,'keywords'),excluded_keywords:csv(form,'excluded_keywords'),locations:csv(form,'locations'),technologies:csv(form,'technologies'),
    work_formats:form.getAll('work_formats').map(String),employment_types:form.getAll('employment_types').map(String)};
   return {name:text(form,'name'),criteria_version:1,enabled:form.get('enabled')==='on',criteria:{
    ...criteria,...(text(form,'instructions')||config?.criteria.instructions!==undefined?{instructions:nullable(form,'instructions')}:{}),...(text(form,'queries')||config?.criteria.queries?{queries:text(form,'queries').split(/\r?\n/).map(q=>q.trim()).filter(Boolean)}:{}),...(form.get('use_hh')==='on'?{hh:{text:nullable(form,'hh_text'),areas:JSON.parse(text(form,'hh_areas')||'[]') as Json,
     experience:form.getAll('hh_experience').map(String),work_formats:form.getAll('hh_work_formats').map(String),employment_forms:form.getAll('hh_employment').map(String),
     period_days:text(form,'hh_period')?Number(text(form,'hh_period')):null,per_page:Number(text(form,'hh_per_page')||20)}}:{}),
   }};
  }
  if(resource==='contacts')return {
   ...(record?{}:{company_id:text(form,'company_id')}),display_name:text(form,'display_name'),email:nullable(form,'email'),
   profile_url:nullable(form,'profile_url'),notes:nullable(form,'notes'),role_ids:form.getAll('role_ids').map(String),
  };
  if(resource==='vacancies') {
   const number=(key:string)=>{const raw=text(form,key);if(!raw)return null;const n=Number(raw);if(!Number.isSafeInteger(n)||n<0)throw new Error('Зарплата должна быть неотрицательным целым числом в минимальных единицах валюты.');return n;};
   return {source_id:text(form,'source_id'),external_vacancy_id:nullable(form,'external_vacancy_id'),external_url:nullable(form,'external_url'),target_vacancy_id:nullable(form,'target_vacancy_id'),
    vacancy:{company_id:text(form,'company_id'),title:text(form,'title'),description:nullable(form,'description'),location:nullable(form,'location'),work_format:nullable(form,'work_format'),
     employment_type:nullable(form,'employment_type'),salary_min:number('salary_min'),salary_max:number('salary_max'),salary_currency:nullable(form,'salary_currency'),public_url:nullable(form,'public_url')},
    observation:{observation_key:ids.observation,observed_at:toUtc(text(form,'observed_at')),search_configuration_id:nullable(form,'search_configuration_id')}};
  }
  return {company_id:text(form,'company_id'),vacancy_id:nullable(form,'vacancy_id'),channel_id:text(form,'channel_id'),subject:nullable(form,'subject'),external_conversation_id:nullable(form,'external_conversation_id'),
   participants:[{participant_key:'self',participant_kind:'user',display_name:'Я'},participantKind==='contact'?
    {participant_key:'contact-'+text(form,'contact_id'),participant_kind:'contact',contact_id:text(form,'contact_id')}:
    {participant_key:'other',participant_kind:'unknown',display_name:text(form,'participant_label')}]};
 }
 const path=resource==='vacancies'?'vacancy-source-references':resource+(record?'/'+record.id:'');
 return <SaveForm path={path} method={record?'PATCH':'POST'} build={build} cancelTo={'/'+resource} redirectTo={result=>'/'+resource+'/'+(resource==='vacancies'?result.vacancy_id:result.id)}>
  {resource==='companies'&&<><Field label="Название компании" name="name" defaultValue={company?.name} maxLength={300} required/><Field label="Сайт" name="website" type="url" defaultValue={company?.website||''} maxLength={2048}/><TextArea label="Заметки" name="notes" value={company?.notes}/></>}
  {resource==='search-configurations'&&<>
   <Field label="Название профиля" name="name" defaultValue={config?.name} required maxLength={200}/>
   <label className="check"><input type="checkbox" name="enabled" defaultChecked={config?.enabled??true}/> Доступен для ручного выбора</label>
   <p className="hint">Критерии сохраняются локально. Автоматический мониторинг не запускается.</p>
   <TextArea label="Инструкции и ограничения поиска" name="instructions" value={config?.criteria.instructions} max={100000}/>
   <p className="hint">Сохраните требования к оплате, графику и найму. Эти инструкции нужны при ручном разборе; поисковые запросы задаются отдельно.</p>
   <TextArea label="Запросы в браузере (по одному на строку)" name="queries" value={config?.criteria.queries?.join('\n')} max={10050}/>
   <p className="hint">У каждого профиля свои запросы и обнаружения. Обычная страница поиска HH открывается только при выборе ссылки.</p>
   <HhCriteriaFields value={config?.criteria.hh}/><p className="hint">Критерии ниже используются для тестовых вакансий. Для HH используются отдельные поля выше.</p><Field label="Должность" name="role" defaultValue={config?.criteria.role||''} maxLength={500}/>
   {(['keywords','excluded_keywords','locations','technologies'] as const).map(key=><Field key={key} label={fieldLabel(key)+' (через запятую)'} name={key} defaultValue={config?.criteria[key].join(', ')||''}/>)}
   <fieldset><legend>Форматы работы</legend>{formats.map(value=><label key={value} className="check"><input type="checkbox" name="work_formats" value={value} defaultChecked={config?.criteria.work_formats.includes(value)}/> {valueLabel(value)}</label>)}</fieldset>
   <fieldset><legend>Виды занятости</legend>{employment.map(value=><label key={value} className="check"><input type="checkbox" name="employment_types" value={value} defaultChecked={config?.criteria.employment_types.includes(value)}/> {valueLabel(value)}</label>)}</fieldset>
  </>}
  {['contacts','vacancies','conversations'].includes(resource)&&(!record?<><Select label="Компания" name="company_id" options={companyChoices} required onChange={setCompanyId}/>{companies.length===0&&<p><Link to="/companies/new">Сначала создайте компанию</Link></p>}</>:<p>Компания: {companies.find(c=>c.id===companyDefault)?.name||companyDefault}</p>)}
  {resource==='contacts'&&<>
   <Field label="Имя контакта" name="display_name" defaultValue={contact?.display_name} maxLength={300} required/>
   <Field label="Электронная почта" name="email" type="email" defaultValue={contact?.email||''} maxLength={320}/>
   <Field label="Ссылка на профиль" name="profile_url" type="url" defaultValue={contact?.profile_url||''} maxLength={2048}/>
   <fieldset><legend>Роли</legend>{roles.map(role=><label className="check" key={role.id}><input type="checkbox" name="role_ids" value={role.id} defaultChecked={contact?.role_ids.includes(role.id)}/> {lookupLabel(role)}</label>)}</fieldset>
   <TextArea label="Заметки" name="notes" value={contact?.notes}/>
  </>}
  {resource==='vacancies'&&<>
   <div className="form-grid"><Field label="Название вакансии" name="title" required maxLength={500}/><Field label="Местоположение" name="location" maxLength={500}/></div>
   <div className="form-grid"><Select label="Формат работы" name="work_format" options={choices(formats)}/><Select label="Вид занятости" name="employment_type" options={choices(employment)}/></div>
   <TextArea label="Описание" name="description" max={100000}/>
   <div className="form-grid"><Field label="Минимальная зарплата (минимальные единицы валюты)" name="salary_min" type="number" min={0} step={1}/><Field label="Максимальная зарплата (минимальные единицы валюты)" name="salary_max" type="number" min={0} step={1}/><Field label="Валюта (например, USD)" name="salary_currency" maxLength={3} pattern="[A-Z]{3}"/></div>
   <p className="hint">Период зарплаты не указан; сравнение зарплат недоступно.</p>
   <Field label="Публичная ссылка на вакансию" name="public_url" type="url" maxLength={2048}/>
   <fieldset><legend>Источник и обнаружение</legend>
    <Select label="Источник" name="source_id" options={sources.filter(s=>s.code!=='hh-browser').map(s=>({id:s.id,label:lookupLabel(s)}))} value={sources.find(s=>s.code==='manual')?.id} required/>
    <Field label="ID вакансии в источнике" name="external_vacancy_id" defaultValue={ids.external} maxLength={500}/>
    <Field label="Ссылка в источнике" name="external_url" type="url" maxLength={2048}/>
    <p className="hint">При повторном обнаружении сохраните тот же ID в источнике. Требуется ID или ссылка в источнике.</p>
    <Field label="Дата обнаружения (местное время)" name="observed_at" type="datetime-local" defaultValue={localNow()} step="0.001" required/>
    <Select label="Профиль поиска" name="search_configuration_id" options={configs.map(c=>({id:c.id,label:c.name+(c.enabled?'':' (выключен)')}))}/>
    <Field label="ID целевой вакансии (необязательно)" name="target_vacancy_id" maxLength={100}/>
    <p className="hint">Укажите известный ID вакансии, чтобы связать ещё один источник в той же компании.</p>
   </fieldset>
  </>}
  {resource==='conversations'&&<>
   <Field label="Тема" name="subject" maxLength={500}/>
   <Select key={'vacancy'+companyId} label="Связанная вакансия" name="vacancy_id" options={vacancies.filter(v=>v.company_id===companyId).map(v=>({id:v.id,label:v.title}))}/>
   <Select label="Канал" name="channel_id" options={channels.map(c=>({id:c.id,label:lookupLabel(c)}))} value={channels.find(c=>c.code==='manual')?.id} required/>
   <Field label="ID переписки в источнике (необязательно)" name="external_conversation_id" maxLength={500}/>
   <fieldset><legend>Участники</legend><p>Вы включены как «Я». Добавьте собеседника.</p>
    <Select label="Другой участник" name="participant_kind" options={[{id:'unknown',label:'Человек без записи контакта'},{id:'contact',label:'Существующий контакт компании'}]} value={participantKind} required onChange={setParticipantKind}/>
    {participantKind==='contact'?<Select key={'contact'+companyId} label="Контакт" name="contact_id" options={contacts.filter(c=>c.company_id===companyId).map(c=>({id:c.id,label:c.display_name}))} required/>:<Field label="Имя участника" name="participant_label" required maxLength={300}/>}
   </fieldset>
  </>}
 </SaveForm>;
}
