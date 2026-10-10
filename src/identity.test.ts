import {afterEach,describe,expect,it,vi} from 'vitest';
import {clientUuid} from './identity';

afterEach(()=>vi.unstubAllGlobals());
describe('client UUIDs on secure and ordinary HTTP origins',()=>{
 it('uses the native crypto implementation when available',()=>{
  const id='1d83a3b2-e5df-4ea6-b129-d7fccd8cc4a6';
  const randomUUID=vi.fn(()=>id);vi.stubGlobal('crypto',{randomUUID});
  expect(clientUuid()).toBe(id);expect(randomUUID).toHaveBeenCalledOnce();
 });
 it('creates a valid v4 variant from secure random bytes without randomUUID',()=>{
  const getRandomValues=vi.fn((bytes:Uint8Array)=>{bytes.set(Array.from({length:16},(_,i)=>i));return bytes;});
  vi.stubGlobal('crypto',{getRandomValues});
  expect(clientUuid()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
  expect(getRandomValues).toHaveBeenCalledOnce();
 });
 it('produces distinct valid receipt IDs in the HTTP fallback',()=>{
  const getRandomValues=globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  vi.stubGlobal('crypto',{getRandomValues});
  const ids=Array.from({length:100},clientUuid);
  expect(new Set(ids).size).toBe(100);
  for(const id of ids)expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 });
 it('fails explicitly when cryptographic randomness is absent',()=>{
  vi.stubGlobal('crypto',undefined);
  expect(()=>clientUuid()).toThrow('черновик не отправлен');
 });
});
