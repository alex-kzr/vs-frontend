import type { RecordBase } from './types';
import type { CVRevision } from './cv-types';
export interface ReviewEvidence {revision_id?:string;vacancy_id?:string;vacancy_version?:string;quote:string;cv_id?:string;run_id?:string;stale?:boolean}
export interface Recommendation extends RecordBase {
 cv_id:string;reference_cv_id:string|null;cv_revision_id:string;reference_revision_id:string|null;origin_run_id:string;last_run_id:string;
 issue_key:string;field:string;category:string;kind:string;mismatch:string;suggested_edit:string;rationale:string;evidence:ReviewEvidence[];
 vacancy_evidence:ReviewEvidence[];vacancy_frequency:number;fresh_vacancy_frequency:number;resolution?:{rationale:string;evidence:ReviewEvidence[]};source_resolutions?:{vacancy_id:string;version:string;rationale:string;evidence:ReviewEvidence[]}[];state:'active'|'resolved'|'rejected';version:number;decision_reason:string|null;stale:boolean
}
export interface VacancyAssessment {vacancy_id:string;vacancy_version:string;relevance:string;summary:string;issue_keys:string[]}
export interface ReviewRun extends RecordBase {
 cv_id:string;cv_revision_id:string;reference_cv_id:string|null;reference_revision_id:string|null;kind:'single'|'cv_compare'|'vacancy_gap';
 version:number;attempt_id:string|null;attempt_number:number;state:'queued'|'running'|'completed'|'failed'|'cancelled';agent?:string;
 stale:boolean;stale_reasons:string[];applied?:boolean;superseded_vacancy_ids?:string[];error?:string|null;
 result?:{provenance:{agent:string;method:string;model:string|null};findings:Recommendation[];resolutions:{issue_key:string;rationale:string}[];vacancy_assessments:VacancyAssessment[]}
}
export interface ReviewVacancy {vacancy_id:string;version:string;snapshot:{id:string;title:string;description:string|null;public_url:string|null;company:{name:string}}}
export interface ReviewPacket {run:ReviewRun;target_revision:CVRevision;reference_revision:CVRevision|null;context_revisions:CVRevision[];vacancies:ReviewVacancy[];previous_recommendations:Recommendation[];instructions:string}
export interface ReviewEvent extends RecordBase {kind:string;snapshot:ReviewRun}
export interface RecommendationEvent extends RecordBase {kind:string;snapshot:Recommendation}
