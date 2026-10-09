import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { all, api, ApiError } from './api';
import type { ApiProblem, Company, HhCriteria, Json, Lookup } from './types';
import { External, Problem, Select, useMutation } from './ui';

interface Candidate {external_vacancy_id:string;external_url:string;company_name:string;vacancy:Record<string,Json> & {title:string;description:string|null;location:string|null;work_format:string|null};source_payload?:Record<string,Json>}
interface Preview {adapter:string;live:boolean;configuration_id:string;scanned:number;matched:number;candidates:Candidate[];page?:number;found?:number;accessible_pages?:number;next_page?:number|null;skipped?:number;notice?:string;fetched_at?:string}
interface PreviewResult {preview:Preview;companies:Company[];sources:Lookup[];requestId:string}
interface HhStatus {configured:boolean;message:string;registration_url:string;terms_url:string;agreement_url:string}
export async function previewLoader(id:string,signal:AbortSignal):Promise<PreviewResult> {
 const [preview,companies,sources]=await Promise.all([
  api<Preview>('search-configurations/'+id+'/preview',{signal}),all<Company>('companies',signal),all<Lookup>('vacancy-sources',signal),
 ]);
 return {preview,companies,sources,requestId:crypto.randomUUID()};
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
  void api<HhStatus>('hh/status',{signal:controller.signal}).then(setStatus).catch(e=>{if(!controller.signal.aborted)setError(e instanceof ApiError?e.problem:{code:'status_error',message:'Could not load HH access status.',fields:{}});});
  return ()=>{controller.abort();const request=active.current;if(request){request.controller.abort();if(request.adapter==='hh')void api('hh/requests/'+request.id,{method:'DELETE'}).catch(()=>undefined);}};
 },[]);
 function stop() {
  const request=active.current;if(!request)return;
  request.controller.abort();if(request.adapter==='hh')void api('hh/requests/'+request.id,{method:'DELETE'}).catch(()=>undefined);
  active.current=null;setPending(false);setMessage('Preview cancelled. Nothing was imported.');
 }
 async function search(adapter:string,page=0) {
  stop();const request={controller:new AbortController(),id:crypto.randomUUID(),adapter};active.current=request;
  setPending(true);setError(null);setMessage('');setResult(null);
  try {
   const [preview,companies,sources]=await Promise.all([
    api<Preview>('search-configurations/'+configurationId+'/preview?adapter='+adapter+'&page='+page+'&request_id='+request.id,{signal:request.controller.signal}),
    all<Company>('companies',request.controller.signal),all<Lookup>('vacancy-sources',request.controller.signal),
   ]);
   if(active.current===request)setResult({preview,companies,sources,requestId:request.id});
  }catch(e){if(!request.controller.signal.aborted)setError(e instanceof ApiError?e.problem:{code:'preview_error',message:'Could not load the preview. Retry manually.',fields:{}});}
  finally{if(active.current===request){active.current=null;setPending(false);}}
 }
 return <div className="panel"><h2>Search preview</h2>
  <p className="hint">hh.ru uses the official API after access setup. Preview stores no vacancies; import only the candidates you select. Fixture search remains offline and synthetic.</p>
  {status&&!status.configured&&<div className="empty-inline"><strong>HH access setup required</strong><p>{status.message}</p><p>Register your own application and configure authorized access locally using the README. Do not paste secrets into this UI.</p><External url={status.registration_url}>HH application registration</External> · <External url={status.terms_url}>HH API terms</External> · <External url={status.agreement_url}>Employment assistance agreement (offer)</External></div>}
  {!hh?.text&&<p className="hint">Edit this configuration to add your own HH query and optional filters.</p>}
  <div className="actions"><button disabled={pending||!status?.configured||!hh?.text} onClick={()=>void search('hh')}>Preview hh.ru</button>
   <button className="secondary" disabled={pending} onClick={()=>void search('fixture-v1')}>Preview fixture search</button>
   {pending&&<button className="secondary" onClick={stop}>Cancel preview</button>}</div>
  <Problem error={error}/>{error?.retry_after_seconds&&<p role="status">Wait at least {error.retry_after_seconds} seconds before another request. There is no automatic retry.</p>}
  <p role="status" aria-live="polite">{pending?'Loading one page…':message}</p>
  {result&&<><p>{result.preview.live?result.preview.matched+' candidates on HH page '+((result.preview.page||0)+1)+'. '+result.preview.found+' found; '+result.preview.accessible_pages+' pages available within the local limit.':result.preview.matched+' of '+result.preview.scanned+' fixture vacancies match.'}</p>
   {result.preview.notice&&<p className="hint">{result.preview.notice}</p>}{Boolean(result.preview.skipped)&&<p className="hint">{result.preview.skipped} duplicate or incompatible entries skipped.</p>}
   {result.preview.candidates.map(candidate=><CandidateImport key={result.requestId+candidate.external_vacancy_id} candidate={candidate} data={result}/>)}
   {result.preview.live&&<div className="actions">{(result.preview.page||0)>0&&<button className="secondary" onClick={()=>void search('hh',(result.preview.page||0)-1)}>Previous HH page</button>}{result.preview.next_page!==null&&result.preview.next_page!==undefined&&<button className="secondary" onClick={()=>void search('hh',result.preview.next_page!)}>Next HH page</button>}</div>}
  </>}
 </div>;
}
function CandidateImport({candidate,data}: {candidate:Candidate;data:PreviewResult}) {
 const mutation=useMutation();const [companyId,setCompanyId]=useState('');const [observation]=useState(()=>({key:crypto.randomUUID(),time:typeof candidate.source_payload?.fetched_at==='string'?candidate.source_payload.fetched_at:new Date().toISOString()}));
 const success=mutation.result?.ok?mutation.result.data:null;
 const source=data.sources.find(s=>s.code===data.preview.adapter);
 const salary=candidate.source_payload?.salary as Record<string,Json>|null|undefined;
 const mode=salary?.mode as Record<string,Json>|null|undefined;
 return <article className="source"><h3>{candidate.vacancy.title}</h3><p>{candidate.company_name} · {candidate.vacancy.location||'Location not provided'} · {candidate.vacancy.work_format||'See source work formats'}</p>
  <External url={candidate.external_url}>Open source vacancy</External>
  {data.preview.live&&<p className="hint">HH search snippet, not the full vacancy description.</p>}<p className="preserve">{candidate.vacancy.description||'No snippet provided.'}</p>
  {salary&&<p>HH salary: {String(salary.from??'not specified')}–{String(salary.to??'not specified')} {String(salary.currency||'')} · {salary.gross===true?'before tax':salary.gross===false?'after tax':'tax basis unspecified'} · {String(mode?.name||mode?.id||'period unspecified')}</p>}
  {success?<p role="status">Imported to SQLite. <Link to={'/vacancies/'+success.vacancy_id}>Open vacancy →</Link></p>:<>
   <Problem error={mutation.error}/>
   <Select label={'Import company for '+candidate.external_vacancy_id} name={'company-'+candidate.external_vacancy_id} options={data.companies.map(c=>({id:c.id,label:c.name}))} required onChange={setCompanyId}/>
   <p className="hint">Explicitly select the matching company. Names are never merged automatically.</p>
   <button disabled={!companyId||!source||mutation.pending} onClick={()=>mutation.submit('vacancy-source-references','POST',{
    source_id:source!.id,external_vacancy_id:candidate.external_vacancy_id,external_url:candidate.external_url,
    vacancy:{...candidate.vacancy,company_id:companyId},observation:{observation_key:observation.key,observed_at:observation.time,search_configuration_id:data.preview.configuration_id,...(candidate.source_payload?{source_payload:candidate.source_payload}:{})},
   })}>{mutation.pending?'Saving…':'Import selected candidate'}</button>{data.companies.length===0&&<Link to="/companies/new">Create a company first</Link>}
   {mutation.error&&<button className="secondary" onClick={mutation.retry} disabled={mutation.pending}>Retry previous submission</button>}
  </>}
 </article>;
}
