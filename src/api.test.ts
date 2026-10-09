import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, all, cleanFilters, toUtc, ApiError } from './api';
afterEach(()=>vi.unstubAllGlobals());
describe('API boundary',()=>{
 it('passes abort signal and exact retry key without automatic retry',async()=>{
  const signal=new AbortController().signal;const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{id:'a'}})));
  vi.stubGlobal('fetch',fetch);await api('companies',{signal,headers:{'Idempotency-Key':'stable'}});
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/v1/companies',{signal,headers:{'Idempotency-Key':'stable'}});
 });
 it('retains field errors from server conflicts',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'message_conflict',message:'Conflict',fields:{body:['Changed']}}}),{status:409})));
  await expect(api('conversations/a/messages')).rejects.toMatchObject({status:409,problem:{code:'message_conflict',fields:{body:['Changed']}}});
 });
 it('marks network loss as unconfirmed',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Failed')));
  await expect(api('companies')).rejects.toBeInstanceOf(ApiError);
 });
 it('keeps cancellation distinct from server errors',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new DOMException('cancel','AbortError')));
  await expect(api('companies')).rejects.toMatchObject({name:'AbortError'});
 });
 it('loads all bounded lookup pages',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({items:[1],next_cursor:'opaque'}))).mockResolvedValueOnce(new Response(JSON.stringify({items:[2],next_cursor:null})));
  vi.stubGlobal('fetch',fetch);expect(await all('companies',new AbortController().signal)).toEqual([1,2]);
  expect(fetch.mock.calls[1][0]).toContain('cursor=opaque');
 });
});
it('filters reset pagination and preserve literal text',()=>{
 expect(cleanFilters(new URLSearchParams('q=Rust%25&status=saved&cursor=old&company_id='),['q','status','company_id']).toString()).toBe('q=Rust%25&status=saved');
});
it('requires an occurrence time',()=>{
 expect(()=>toUtc('')).toThrow('Select an occurrence time.');
 expect(toUtc('2026-10-09T12:00:00Z')).toBe('2026-10-09T12:00:00.000Z');
});
