import { describe, expect, it } from 'vitest';
import { fieldLabel, fieldMessage, lookupLabel, problemMessage, statusChoices, statuses, valueLabel } from './i18n';
describe('Russian presentation keeps stored identities and user content',()=>{
 it('labels every status and exposes two explicit refusal choices',()=>{
  expect(statuses.map(valueLabel)).toEqual(['Новая','Сохранена','Связался','Я отказался','Работодатель отказал','Отказ — сторона не указана','В архиве']);
  expect(statusChoices().map(x=>x.id)).not.toContain('rejected');
  expect(statusChoices('rejected').find(x=>x.id==='rejected')?.label).toBe('Отказ — сторона не указана');
 });
 it('localizes enum vocabulary without translating free text',()=>{
  expect(valueLabel('remote')).toBe('Удалённо');expect(valueLabel('LangGraph / Rust')).toBe('LangGraph / Rust');
  expect(fieldLabel('status')).toBe('Статус');expect(fieldMessage('Unsupported status.')).toBe('Выберите допустимый статус вакансии.');
 });
 it('only translates known default lookup labels',()=>{
  const base={id:'fixture',code:'recruiter',created_at:'',updated_at:''};
  expect(lookupLabel({...base,label:'Recruiter'})).toBe('Рекрутер');
  expect(lookupLabel({...base,label:'My custom role'})).toBe('My custom role');
 });
 it('keeps provider rejection errors separate from vacancy refusal',()=>{
  const problem={code:'hh_invalid_criteria',message:'HH rejected the search parameters.',fields:{}};
  expect(problemMessage(problem)).toContain('параметры поиска');expect(problem.code).toBe('hh_invalid_criteria');
  expect(problemMessage({code:'unconfirmed_submission',message:'Unconfirmed',fields:{}})).toContain('без изменений');
 });
});
