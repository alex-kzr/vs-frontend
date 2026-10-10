import { useEffect, useRef, useState, type FormEvent, type ReactNode, type ComponentPropsWithoutRef } from 'react';
import { Link, useBlocker, useBeforeUnload, useFetcher, useNavigate, useRevalidator, type ActionFunctionArgs, data } from 'react-router';
import { api, ApiError } from './api';
import type { ApiProblem, Json } from './types';
import { fieldLabel, fieldMessage, problemMessage, valueLabel } from './i18n';
export { statuses } from './i18n';

export type Mutation = {path:string;method:'POST'|'PATCH';body:Json;key:string};
export type MutationResult = {ok:true;data:{id?:string;vacancy_id?:string};deduplicated?:boolean} | {ok:false;error:ApiProblem;status:number};
export async function mutationAction({request}:ActionFunctionArgs) {
  const mutation=await request.json() as Mutation;
  try {
    const response=await api<{data:{id?:string;vacancy_id?:string};deduplicated?:boolean}>(mutation.path,{
      method:mutation.method,headers:{'Content-Type':'application/json',...(mutation.method==='POST'?{'Idempotency-Key':mutation.key}:{})},
      body:JSON.stringify(mutation.body),signal:request.signal,
    });
    return {ok:true,...response} satisfies MutationResult;
  } catch(error) {
    const e=error instanceof ApiError?error:new ApiError(0,{code:'network_error',message:'Не удалось подтвердить сохранение. Повторите тот же запрос.',fields:{}});
    return data({ok:false,error:e.problem,status:e.status} satisfies MutationResult,{status:e.status||503});
  }
}
export function useMutation() {
  const fetcher=useFetcher<MutationResult>();
  const attempt=useRef<Mutation|null>(null);
  const [localError,setLocalError]=useState<ApiProblem|null>(null);
  function submit(path:string,method:'POST'|'PATCH',body:Json) {
    const previous=attempt.current;
    if (previous && fetcher.data && !fetcher.data.ok && (fetcher.data.status===0 || fetcher.data.status>=500) &&
       JSON.stringify(previous.body)!==JSON.stringify(body)) {
      setLocalError({code:'unconfirmed_submission',message:'Предыдущее сохранение не подтверждено. Повторите его без изменений, прежде чем редактировать и сохранять снова.',fields:{}});
      return;
    }
    const key=previous && JSON.stringify(previous.body)===JSON.stringify(body) ? previous.key : crypto.randomUUID();
    attempt.current={path,method,body,key};setLocalError(null);
    void fetcher.submit(attempt.current,{method:'post',action:'/_mutate',encType:'application/json'});
  }
  function retry() {
    if (attempt.current) {setLocalError(null);void fetcher.submit(attempt.current,{method:'post',action:'/_mutate',encType:'application/json'});}
  }
  return {submit,retry,pending:fetcher.state!=='idle',
    result:fetcher.data,error:localError||(fetcher.data&&!fetcher.data.ok?fetcher.data.error:null),
    reset:()=>{attempt.current=null;setLocalError(null);fetcher.reset();}};
}
export function Problem({error}: {error:ApiProblem|null}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(error)ref.current?.focus();},[error]);
  if(!error)return null;
  return <div className="problem" role="alert" tabIndex={-1} ref={ref}><strong>{problemMessage(error)}</strong>
    {Object.entries(error.fields).map(([field,messages])=><p key={field}><a href={'#'+field}>{fieldLabel(field)}</a>: {messages.map(fieldMessage).join(' ')}</p>)}
    <small>Код ошибки: {error.code}{error.request_id?' · '+error.request_id:''}</small></div>;
}
export function Field({label,name,children,...props}:ComponentPropsWithoutRef<'input'> & {label:string;name:string;children?:ReactNode}) {
  return <div className="field"><label htmlFor={name}><span>{label}</span></label>{children||<input id={name} name={name} onInvalid={e=>e.currentTarget.setCustomValidity('Проверьте поле «'+label+'»: '+(e.currentTarget.validity.valueMissing?'заполните обязательное значение.':'укажите допустимое значение и формат.'))} onInput={e=>e.currentTarget.setCustomValidity('')} {...props}/>}</div>;
}
export function TextArea({label,name,value,max=10000,required=false}: {label:string;name:string;value?:string|null;max?:number;required?:boolean}) {
 return <Field label={label} name={name}><textarea onInvalid={e=>e.currentTarget.setCustomValidity('Заполните поле «'+label+'».')} onInput={e=>e.currentTarget.setCustomValidity('')} id={name} name={name} defaultValue={value||''} maxLength={max} required={required} rows={4}/></Field>;
}
export function Select({label,name,options,value='',required=false,onChange}: {label:string;name:string;options:{id:string;label:string}[];value?:string;required?:boolean;onChange?:(value:string)=>void}) {
 return <Field label={label} name={name}><select onInvalid={e=>e.currentTarget.setCustomValidity('Выберите значение поля «'+label+'».')} onInput={e=>e.currentTarget.setCustomValidity('')} id={name} name={name} defaultValue={value} required={required} onChange={e=>onChange?.(e.target.value)}><option value="">{required?'Выберите…':'Любые / не указано'}</option>
  {options.map(o=><option value={o.id} key={o.id}>{o.label}</option>)}</select></Field>;
}
export const formats=['remote','hybrid','onsite'] as const;
export const employment=['full_time','part_time','contract','internship','temporary'] as const;
export const choices=(values:readonly string[])=>values.map(id=>({id,label:valueLabel(id)}));
export function stamp(value:string|null) {return value?new Date(value).toLocaleString('ru-RU',{timeZoneName:'short'}):'Не указано';}
export function Time({value}: {value:string|null}) {return <time dateTime={value||undefined} title={value||undefined}>{stamp(value)}</time>;}
export function localNow() {const d=new Date();return new Date(d.valueOf()-d.getTimezoneOffset()*60000).toISOString().slice(0,19);}
export function External({url,children}: {url:string|null;children?:ReactNode}) {
 if(!url || !/^https?:\/\//i.test(url))return <span>Не указано</span>;
 return <a href={url} target="_blank" rel="noreferrer">{children||url}</a>;
}
export function Refresh() {const revalidator=useRevalidator();return <button type="button" className="secondary" disabled={revalidator.state!=='idle'} onClick={()=>void revalidator.revalidate()}>Обновить</button>;}
export function DraftGuard({dirty}: {dirty:boolean}) {
 const blocker=useBlocker(dirty);
 useBeforeUnload((event)=>{if(dirty){event.preventDefault();event.returnValue='';}});
 if(blocker.state!=='blocked')return null;
 return <div className="dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="discard-title"><h2 id="discard-title">Отменить несохранённые изменения?</h2><p>Текущий черновик не сохранён.</p>
  <button onClick={()=>blocker.reset()}>Продолжить редактирование</button> <button className="secondary" onClick={()=>blocker.proceed()}>Отменить изменения</button></section></div>;
}
export function SaveForm({path,method='POST',build,children,cancelTo,redirectTo}: {path:string;method?:'POST'|'PATCH';build:(form:FormData)=>Json;children:ReactNode;cancelTo:string;redirectTo?:(data:{id?:string;vacancy_id?:string})=>string}) {
 const mutation=useMutation();const [dirty,setDirty]=useState(false);const [error,setError]=useState<ApiProblem|null>(null);const navigate=useNavigate();
 const success=mutation.result?.ok===true;
 useEffect(()=>{if(mutation.result?.ok && redirectTo)void navigate(redirectTo(mutation.result.data));},[mutation.result,navigate,redirectTo]);
 function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();setError(null);
  try {mutation.submit(path,method,build(new FormData(event.currentTarget)));}
  catch(e){setError({code:'validation_failed',message:e instanceof Error?e.message:'Проверьте форму.',fields:{}});}
 }
 return <><DraftGuard dirty={dirty&&!success}/><form onSubmit={submit} onChange={()=>{setDirty(true);if(success)mutation.reset();}}>
  <Problem error={error||mutation.error}/>{children}
  <div className="actions"><button disabled={mutation.pending}>{mutation.pending?'Сохранение…':method==='PATCH'?'Сохранить изменения':'Сохранить запись'}</button><Link className="button secondary" to={cancelTo}>Отмена</Link>
   {mutation.error&&<button type="button" className="secondary" disabled={mutation.pending} onClick={mutation.retry}>Повторить предыдущий запрос</button>}</div>
  <p role="status" aria-live="polite">{success?'Сохранено в SQLite.':''}</p>
 </form></>;
}
export const text=(form:FormData,name:string)=>String(form.get(name)||'').trim();
export const nullable=(form:FormData,name:string)=>text(form,name)||null;
export const csv=(form:FormData,name:string)=>text(form,name).split(',').map(s=>s.trim()).filter(Boolean);
