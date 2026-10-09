import type { ApiProblem, Page } from './types';

export class ApiError extends Error {
  constructor(public status:number, public problem:ApiProblem) {super(problem.message);}
}
export async function api<T>(path:string, options:RequestInit = {}):Promise<T> {
  let response:Response;
  try {
    response=await fetch('/api/v1/'+path,options);
  } catch (error) {
    if (error instanceof DOMException && error.name==='AbortError') throw error;
    throw new ApiError(0,{code:'network_error',message:'Connection lost. Your draft is retained; retry the same submission.',fields:{}});
  }
  const result:unknown=await response.json().catch(()=>null);
  if (!response.ok) {
    const problem=result && typeof result==='object' && 'error' in result ? result.error as ApiProblem :
      {code:'invalid_response',message:'The server returned an unreadable error.',fields:{}};
    throw new ApiError(response.status,problem);
  }
  if (!result || typeof result!=='object') throw new ApiError(0,{code:'invalid_response',message:'Cannot confirm the operation. Retry the same submission.',fields:{}});
  return result as T;
}
export async function all<T>(path:string, signal:AbortSignal):Promise<T[]> {
  const items:T[]=[];
  let cursor:string|null=null;
  do {
    const separator=path.includes('?')?'&':'?';
    const page:Page<T>=await api<Page<T>>(path+separator+'limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''),{signal});
    items.push(...page.items);cursor=page.next_cursor;
  } while(cursor);
  return items;
}
export function cleanFilters(parameters:URLSearchParams,allowed:readonly string[]):URLSearchParams {
  return new URLSearchParams([...parameters].filter(([key,value])=>allowed.includes(key)&&value.trim()!==''));
}
export function toUtc(value:string):string {
  const date=new Date(value);
  if (!value || Number.isNaN(date.valueOf())) throw new Error('Select an occurrence time.');
  return date.toISOString();
}
