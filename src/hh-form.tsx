import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import type { ApiProblem, HhCriteria } from './types';
import { Field, Problem } from './ui';

export const hhWorkFormats=[['ON_SITE','On site'],['REMOTE','Remote'],['HYBRID','Hybrid'],['FIELD_WORK','Field work']] as const;
export const hhExperience=[['noExperience','No experience'],['between1And3','1–3 years'],['between3And6','3–6 years'],['moreThan6','Over 6 years']] as const;
export const hhEmployment=[['FULL','Full time'],['PART','Part time'],['PROJECT','Project work'],['FLY_IN_FLY_OUT','Rotational work']] as const;

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
  }catch(e){if(!request.controller.signal.aborted)setError(e instanceof ApiError?e.problem:{code:'region_error',message:'Could not load HH regions.',fields:{}});}
  finally{if(active.current===request){active.current=null;setPending(false);}}
 }
 return <fieldset><legend>hh.ru search</legend>
  <label className="check"><input type="checkbox" name="use_hh" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Enable HH criteria for this configuration</label>
  <p className="hint">HH uses its own query syntax and the filters below. Fixture preferences are separate. Saving criteria starts no search or schedule.</p>
  <Field label="HH query" name="hh_text" defaultValue={value?.text||''} disabled={!enabled} required={enabled} maxLength={1000} placeholder="Enter your own job title or HH search expression"/>
  <div className="form-grid"><Field label="HH publication period (days, optional)" name="hh_period" type="number" min={1} max={30} step={1} defaultValue={value?.period_days||''} disabled={!enabled}/><Field label="HH results per page" name="hh_per_page" type="number" min={1} max={50} step={1} defaultValue={value?.per_page||20} disabled={!enabled}/></div>
  <p className="hint">One requested page at a time; up to 200 results per view. No region is selected by default.</p>
  <fieldset disabled={!enabled}><legend>HH regions</legend>
   <Field label="Find HH region" name="hh_region_query" value={query} onChange={e=>setQuery(e.target.value)} maxLength={200}/>
   <button type="button" className="secondary" disabled={pending||query.trim().length<2} onClick={()=>void findAreas()}>Find regions on HH</button>
   {pending&&<button type="button" className="secondary" onClick={()=>{stop();setPending(false);}}>Cancel region lookup</button>}
   <Problem error={error}/>
   {[...areas,...suggestions.filter(area=>!areas.some(selected=>selected.id===area.id))].map(area=>{
    const selected=areas.some(current=>current.id===area.id);
    return <label className="check" key={area.id}><input type="checkbox" checked={selected} disabled={!selected&&areas.length>=10} onChange={()=>setAreas(previous=>selected?previous.filter(a=>a.id!==area.id):[...previous,area])}/> {area.name}</label>;
   })}
   {!areas.length&&<p className="hint">All regions. A region lookup requires configured HH API access.</p>}
   <input type="hidden" name="hh_areas" value={JSON.stringify(areas)}/>
  </fieldset>
  {([['HH experience','hh_experience',hhExperience,value?.experience],['HH work formats','hh_work_formats',hhWorkFormats,value?.work_formats],['HH employment','hh_employment',hhEmployment,value?.employment_forms]] as const).map(([legend,name,options,selected])=><fieldset key={name} disabled={!enabled}><legend>{legend}</legend>{options.map(([id,label])=><label className="check" key={id}><input type="checkbox" name={name} value={id} defaultChecked={selected?.includes(id)}/> HH: {label}</label>)}</fieldset>)}
 </fieldset>;
}
