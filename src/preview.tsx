import { useState } from 'react';
import { Link, useFetcher } from 'react-router';
import { api } from './api';
import type { Company, Json, Lookup } from './types';
import { Problem, Select, useMutation } from './ui';

interface Candidate {external_vacancy_id:string;external_url:string;company_name:string;vacancy:Record<string,Json> & {title:string;description:string;location:string;work_format:string}}
interface Preview {adapter:string;live:false;configuration_id:string;scanned:number;matched:number;candidates:Candidate[]}
interface PreviewResult {preview:Preview;companies:Company[];sources:Lookup[]}
export async function previewLoader(id:string,signal:AbortSignal):Promise<PreviewResult> {
 const [preview,companies,sources]=await Promise.all([
  api<Preview>('search-configurations/'+id+'/preview',{signal}),
  api<{items:Company[]}>('companies?limit=100',{signal}),
  api<{items:Lookup[]}>('vacancy-sources?limit=100',{signal}),
 ]);
 return {preview,companies:companies.items,sources:sources.items};
}
export function SearchPreview({configurationId}: {configurationId:string}) {
 const fetcher=useFetcher<PreviewResult>();
 return <div className="panel"><h2>Search preview</h2><p className="hint">Offline synthetic vacancies. This tests your saved criteria; it does not contact any job site. Preview changes no records.</p>
  <button disabled={fetcher.state!=='idle'} onClick={()=>void fetcher.load('/search-configurations/'+configurationId+'/preview')}>{fetcher.state==='idle'?'Preview fixture search':'Matching…'}</button>
  {fetcher.data&&<><p>{fetcher.data.preview.matched} of {fetcher.data.preview.scanned} fixture vacancies match.</p>{fetcher.data.preview.candidates.map(candidate=><CandidateImport key={configurationId+candidate.external_vacancy_id} candidate={candidate} data={fetcher.data!}/>)}</>}
 </div>;
}
function CandidateImport({candidate,data}: {candidate:Candidate;data:PreviewResult}) {
 const mutation=useMutation();const [companyId,setCompanyId]=useState('');const [observation]=useState(()=>({key:crypto.randomUUID(),time:new Date().toISOString()}));
 const success=mutation.result?.ok?mutation.result.data:null;
 const source=data.sources.find(s=>s.code==='fixture-v1');
 return <article className="source"><h3>{candidate.vacancy.title}</h3><p>{candidate.company_name} · {candidate.vacancy.location} · {candidate.vacancy.work_format}</p><p>{candidate.vacancy.description}</p>
  {success?<p role="status">Imported to SQLite. <Link to={'/vacancies/'+success.vacancy_id}>Open vacancy →</Link></p>:<>
   <Problem error={mutation.error}/>
   <Select label={'Import company for '+candidate.external_vacancy_id} name={'company-'+candidate.external_vacancy_id} options={data.companies.map(c=>({id:c.id,label:c.name}))} required onChange={setCompanyId}/>
   <p className="hint">Explicitly select a company for this synthetic example. No automatic name matching occurs.</p>
   <button disabled={!companyId||!source||mutation.pending} onClick={()=>mutation.submit('vacancy-source-references','POST',{
    source_id:source!.id,external_vacancy_id:candidate.external_vacancy_id,external_url:candidate.external_url,
    vacancy:{...candidate.vacancy,company_id:companyId},observation:{observation_key:observation.key,observed_at:observation.time,search_configuration_id:data.preview.configuration_id},
   })}>{mutation.pending?'Saving…':'Import selected candidate'}</button>{data.companies.length===0&&<Link to="/companies/new">Create a company first</Link>}
   {mutation.error&&<button className="secondary" onClick={mutation.retry} disabled={mutation.pending}>Retry previous submission</button>}
  </>}
 </article>;
}
