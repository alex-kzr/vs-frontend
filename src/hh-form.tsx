import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import type { ApiProblem, HhCriteria } from './types';
import { Field, Problem } from './ui';

export const hhWorkFormats=[['ON_SITE','В офисе'],['REMOTE','Удалённо'],['HYBRID','Гибридный формат'],['FIELD_WORK','Разъездная работа']] as const;
export const hhExperience=[['noExperience','Без опыта'],['between1And3','От 1 до 3 лет'],['between3And6','От 3 до 6 лет'],['moreThan6','Более 6 лет']] as const;
export const hhEmployment=[['FULL','Полная занятость'],['PART','Частичная занятость'],['PROJECT','Проектная работа'],['FLY_IN_FLY_OUT','Вахта']] as const;

export function HhCriteriaFields({value}: {value?:HhCriteria}) {
 const [enabled,setEnabled]=useState(Boolean(value));
 const [areas,setAreas]=useState(value?.areas||[]);
 const [query,setQuery]=useState('');
 const [suggestions,setSuggestions]=useState<{id:string;name:string}[]>([]);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState<ApiProblem|null>(null);
 const active=useRef<{controller:AbortController;id:string}|null>(null);
 function stop() {
  const request=active.current;if(!request)return;
  request.controller.abort();active.current=null;
  void api('hh/requests/'+request.id,{method:'DELETE'}).catch(()=>undefined);
 }
 useEffect(()=>()=>{const request=active.current;if(request){request.controller.abort();void api('hh/requests/'+request.id,{method:'DELETE'}).catch(()=>undefined);}},[]);
 async function findAreas() {
  stop();const request={controller:new AbortController(),id:crypto.randomUUID()};active.current=request;setPending(true);setError(null);
  try {
   const result=await api<{items:{id:string;name:string}[]}>('hh/areas?text='+encodeURIComponent(query.trim())+'&request_id='+request.id,{signal:request.controller.signal});
   if(active.current===request)setSuggestions(result.items);
  }catch(e){if(!request.controller.signal.aborted)setError(e instanceof ApiError?e.problem:{code:'region_error',message:'Не удалось загрузить регионы HH.',fields:{}});}
  finally{if(active.current===request){active.current=null;setPending(false);}}
 }
 return <fieldset><legend>Поиск hh.ru</legend>
  <label className="check"><input type="checkbox" name="use_hh" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Использовать критерии HH для этого профиля</label>
  <p className="hint">HH использует свой синтаксис запросов и фильтры ниже. Критерии тестовых вакансий задаются отдельно. Сохранение не запускает поиск или расписание.</p>
  <Field label="Запрос HH" name="hh_text" defaultValue={value?.text||''} disabled={!enabled} required={enabled} maxLength={1000} placeholder="Введите название должности или поисковое выражение HH"/>
  <div className="form-grid"><Field label="Период публикации HH (дни, необязательно)" name="hh_period" type="number" min={1} max={30} step={1} defaultValue={value?.period_days||''} disabled={!enabled}/><Field label="Вакансий на странице HH" name="hh_per_page" type="number" min={1} max={50} step={1} defaultValue={value?.per_page||20} disabled={!enabled}/></div>
  <p className="hint">Запрашивается одна страница за раз, до 200 результатов просмотра. Регион по умолчанию не выбран.</p>
  <fieldset disabled={!enabled}><legend>Регионы HH</legend>
   <Field label="Поиск региона HH" name="hh_region_query" value={query} onChange={e=>setQuery(e.target.value)} maxLength={200}/>
   <button type="button" className="secondary" disabled={pending||query.trim().length<2} onClick={()=>void findAreas()}>Найти регионы HH</button>
   {pending&&<button type="button" className="secondary" onClick={()=>{stop();setPending(false);}}>Отменить поиск регионов</button>}
   <Problem error={error}/>
   {[...areas,...suggestions.filter(area=>!areas.some(selected=>selected.id===area.id))].map(area=>{
    const selected=areas.some(current=>current.id===area.id);
    return <label className="check" key={area.id}><input type="checkbox" checked={selected} disabled={!selected&&areas.length>=10} onChange={()=>setAreas(previous=>selected?previous.filter(a=>a.id!==area.id):[...previous,area])}/> {area.name}</label>;
   })}
   {!areas.length&&<p className="hint">Все регионы. Для поиска регионов требуется настроенный доступ к API HH.</p>}
   <input type="hidden" name="hh_areas" value={JSON.stringify(areas)}/>
  </fieldset>
  {([['Опыт HH','hh_experience',hhExperience,value?.experience],['Форматы работы HH','hh_work_formats',hhWorkFormats,value?.work_formats],['Занятость HH','hh_employment',hhEmployment,value?.employment_forms]] as const).map(([legend,name,options,selected])=><fieldset key={name} disabled={!enabled}><legend>{legend}</legend>{options.map(([id,label])=><label className="check" key={id}><input type="checkbox" name={name} value={id} defaultChecked={selected?.includes(id)}/> HH: {label}</label>)}</fieldset>)}
 </fieldset>;
}
