import type { RecordBase, Json } from './types';
export interface CVSource {kind:string;observed_at:string;url:string|null;file_name:string|null;agent:string|null}
export interface CV extends RecordBase {name:string;hh_url:string|null;current_revision_id:string;current_revision_number:number;imported_at:string;revision?:CVRevision}
export interface CVRevision extends RecordBase {cv_id:string;revision_number:number;name:string;hh_url:string|null;content:string;structured:Json;source:CVSource;imported_at:string}
export type RevisionMeta=Omit<CVRevision,'content'|'structured'>;
export interface MatchRun extends RecordBase {cv_id:string;cv_revision_id:string;cv_revision_number:number;cv_name:string;state:string;counts:Record<string,number>;stale:boolean;cv_stale:boolean;stale_vacancies:number}
export interface Evidence {source:'cv'|'vacancy';path:string;quote:string|null}
export interface Finding {dimension:string;statement:string;evidence:Evidence[]}
export interface Assessment {summary:string;matches:Finding[];gaps:Finding[];questions:Finding[];unknowns:Finding[]}
export interface MatchEngine {kind:string;agent:string;provider:string|null;model:string|null;version:string|null}
export interface MatchJob extends RecordBase {run_id:string;vacancy_id:string;vacancy_title:string;company_name:string;state:string;attempt_id:string;attempt_number:number;assessment:Assessment|null;engine:MatchEngine|null;error:{code:string;message:string}|null;stale:boolean;snapshot:{title:string;description:string|null;company:{name:string}}}
export interface MatchAttempt extends RecordBase {attempt_number:number;state:string;agent:string|null;engine:MatchEngine|null;assessment:Assessment|null;error:{code:string;message:string}|null}
export const states:Record<string,string>={pending:'В очереди',running:'У агента',completed:'Завершено',partial:'Частичный результат',failed:'Ошибка',cancelled:'Отменено'};
export const sourceKinds:Record<string,string>={manual_text:'Вставленный текст',manual_file:'Локальный файл',manual_edit:'Ручное редактирование',hh_browser:'Просмотр HH внешним агентом'};
