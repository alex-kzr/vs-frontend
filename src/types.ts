export type Json = null | boolean | number | string | Json[] | { [key:string]:Json };
export interface RecordBase {id:string;created_at:string;updated_at:string}
export interface Company extends RecordBase {name:string;website:string|null;notes:string|null}
export interface HhCriteria {text:string|null;areas:{id:string;name:string}[];experience:string[];work_formats:string[];employment_forms:string[];period_days:number|null;per_page:number}
export interface Criteria {queries?:string[];hh?:HhCriteria;role:string|null;keywords:string[];excluded_keywords:string[];locations:string[];technologies:string[];work_formats:string[];employment_types:string[]}
export interface Configuration extends RecordBase {name:string;criteria_version:number;criteria:Criteria;enabled:boolean}
export interface Lookup extends RecordBase {code:string;label?:string;name?:string;enabled?:boolean}
export interface Contact extends RecordBase {company_id:string;display_name:string;email:string|null;profile_url:string|null;notes:string|null;role_ids:string[];roles:Lookup[]}
export interface Reference extends RecordBase {vacancy_id:string;source_id:string;external_vacancy_id:string|null;external_url:string|null;first_seen_at:string;last_seen_at:string;link_basis:string}
export interface Vacancy extends RecordBase {
 company_id:string;company:{id:string;name:string};title:string;description:string|null;location:string|null;work_format:string|null;employment_type:string|null;salary_min:number|null;salary_max:number|null;salary_currency:string|null;public_url:string|null;status:string;notes:string|null;first_seen_at:string;last_seen_at:string;source_count:number;source_references?:Reference[]
}
export interface Participant extends RecordBase {conversation_id:string;participant_key:string;participant_kind:'user'|'contact'|'unknown';contact_id:string|null;display_name:string}
export interface Conversation extends RecordBase {company_id:string;vacancy_id:string|null;channel_id:string;external_conversation_id:string|null;subject:string|null;started_at:string|null;last_message_at:string|null;participants?:Participant[]}
export interface Message extends RecordBase {conversation_id:string;sender_participant_id:string;sender_contact_id:string|null;direction:string;body:string;occurred_at:string;received_at:string}
export interface Discovery extends RecordBase {vacancy_id:string;source_reference_id:string;observation_key:string;search_configuration_id:string|null;observed_at:string;criteria_snapshot:{criteria_version:number;criteria:Criteria}|null;normalized_payload:Json;source_payload?:Json}
export interface Page<T> {items:T[];next_cursor:string|null}
export interface ApiProblem {code:string;message:string;fields:Record<string,string[]>;request_id?:string;retry_after_seconds?:number|null}
