import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLoaderData, useNavigate, type LoaderFunctionArgs } from 'react-router';
import { api, all } from './api';
import type { CV } from './cv-types';
import type { Vacancy } from './types';
import type { Recommendation, RecommendationEvent, ReviewEvidence, ReviewEvent, ReviewPacket, ReviewRun } from './cv-review-types';
import { Field, Problem, Refresh, Time, useMutation } from './ui';
const states:Record<string,string>={queued:'Ожидает агента',running:'Проверяется агентом',completed:'Проверка завершена',failed:'Ошибка проверки',cancelled:'Проверка отменена',active:'Актуальное замечание',resolved:'Устранено повторной проверкой',rejected:'Отклонено пользователем'};
const kinds:Record<string,string>={single:'Проверка CV',cv_compare:'Сравнение CV → CV',vacancy_gap:'Пробелы относительно вакансий'};
const categories:Record<string,string>={inconsistent_fact:'Противоречие фактов в CV',omitted_supported_experience:'Опыт описан в другом CV',unconfirmed_requirement:'Требование не подтверждено',experience_mismatch:'Явное несоответствие опыту',clarification:'Нужно уточнение'};
const fields:Record<string,string>={content:'Текст CV',summary:'Описание',skills:'Навыки',experience:'Опыт',education:'Образование',source:'Источник',consistency:'Согласованность'};
const relevance:Record<string,string>={high:'Высокая',partial:'Частичная',low:'Низкая',unknown:'Недостаточно данных'};
function Evidence({items,cvId}:{items:ReviewEvidence[];cvId:string}) {
 return <ul>{items.map((e,index)=><li key={index}><q>{e.quote}</q>{e.revision_id?<span> · ревизия CV <Link to={'/cvs/'+(e.cv_id||cvId)+'/revisions/'+e.revision_id}>{e.revision_id}</Link></span>:<span> · <Link to={'/vacancies/'+e.vacancy_id}>Вакансия</Link> · версия <Time value={e.vacancy_version||null}/>{e.stale&&' · требует повторной проверки'}</span>}</li>)}</ul>;
}
export function RecommendationContent({rec}:{rec:Recommendation}) {
 return <><p><strong>{states[rec.state]}</strong> · {categories[rec.category]||rec.category} · {fields[rec.field]||rec.field}</p>
 {rec.stale&&<p className="hint" role="status">Входы изменились или появилась новая проверка. Нужно повторить проверку; статус замечания сохранён.</p>}
 <h3>{rec.mismatch}</h3><p className="preserve"><strong>Предлагаемая правка: </strong>{rec.suggested_edit}</p><p><strong>Почему: </strong>{rec.rationale}</p>
 <p>Доказательства исходного замечания:</p><Evidence items={rec.evidence} cvId={rec.cv_id}/>
 {rec.resolution&&<div><p><strong>Подтверждение повторной проверки: </strong>{rec.resolution.rationale}</p><Evidence items={rec.resolution.evidence} cvId={rec.cv_id}/></div>}
 {rec.vacancy_frequency>0&&<details><summary>Это требование встречалось в {rec.vacancy_frequency} вакансиях</summary><p>С проверенными текущими входами: {rec.fresh_vacancy_frequency??0}. Остальные источники сохраняются как история.</p><Evidence items={rec.vacancy_evidence} cvId={rec.cv_id}/>{rec.source_resolutions?.map(r=><p key={r.vacancy_id}>Проверка устранения для <Link to={'/vacancies/'+r.vacancy_id}>вакансии</Link>: {r.rationale}</p>)}<p className="hint">Ссылки сохраняют историческое доказательство; новая версия вакансии требует повторной проверки.</p></details>}
 {rec.decision_reason&&<p>Решение пользователя: {rec.decision_reason}</p>}
 <p><Link to={'/cv-reviews/'+rec.last_run_id}>Проверка и происхождение</Link> · <Link to={'/cvs/'+rec.cv_id+'/recommendations/'+rec.id}>История замечания</Link></p></>;
}
function Decision({rec}:{rec:Recommendation}) {
 const mutation=useMutation();const[reason,setReason]=useState('');
 if(rec.state==='resolved')return null;
 function submit(){mutation.submit('cv-recommendations/'+rec.id+'/decision','POST',{expected_version:rec.version,state:rec.state==='rejected'?'active':'rejected',reason:reason.trim()||null});}
 return <div><Field label="Причина решения (необязательно)" name={'reason-'+rec.id} value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/>
 <Problem error={mutation.error}/><button className="secondary" type="button" disabled={mutation.pending} onClick={submit}>{rec.state==='rejected'?'Вернуть замечание в активные':'Отклонить рекомендацию'}</button>{mutation.error&&<button type="button" className="secondary" disabled={mutation.pending} onClick={mutation.retry}>Повторить предыдущий запрос</button>}</div>;
}
export function RecommendationsBlock({cv,cvs,runs,recommendations,vacancies}:{cv:CV;cvs:CV[];runs:ReviewRun[];recommendations:Recommendation[];vacancies:Vacancy[]}) {
 const mutation=useMutation();const navigate=useNavigate();const[mode,setMode]=useState('single');const[reference,setReference]=useState('');const[confirmed,setConfirmed]=useState(false);
 const others=cvs.filter(c=>c.id!==cv.id&&!c.deleted_at);const selected=others.find(c=>c.id===reference);
 useEffect(()=>{if(mutation.result?.ok)void navigate('/cv-reviews/'+mutation.result.data.id);},[mutation.result,navigate]);
 function submit(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();if(!confirmed||mutation.pending)return;
  mutation.submit('cv-review-runs','POST',{cv_id:cv.id,expected_revision_id:cv.current_revision_id,confirmed:true,reference_cv_id:mode==='cv'?selected?.id||null:null,expected_reference_revision_id:mode==='cv'?selected?.current_revision_id||null:null,
   ...(mode==='vacancies'?{vacancies:vacancies.map(v=>({id:v.id,expected_updated_at:v.updated_at})),context_cvs:others.map(c=>({id:c.id,expected_revision_id:c.current_revision_id}))}:{})});
 }
 return <section className="panel" aria-labelledby="cv-recommendations-title"><h2 id="cv-recommendations-title">Рекомендации по CV</h2>
 <p>Проверку выполняет агент по явному поручению. Исправьте CV в источнике, импортируйте новую версию и запустите проверку снова. Импорт не закрывает замечания.</p>
 {!cv.deleted_at&&<form onSubmit={submit}><fieldset disabled={mutation.pending}><legend>Новая проверка текущей версии CV</legend>
 <Field label="Тип проверки" name="review-mode"><select id="review-mode" value={mode} onChange={e=>{setMode(e.target.value);setConfirmed(false);}}><option value="single">Проверить одно CV</option><option value="cv">Сравнить с другим CV</option><option value="vacancies">Проверить все сохранённые вакансии</option></select></Field>
 {mode==='cv'&&<Field label="CV для сравнения" name="review-reference"><select id="review-reference" value={reference} onChange={e=>{setReference(e.target.value);setConfirmed(false);}} required><option value="">Выберите CV…</option>{others.map(c=><option value={c.id} key={c.id}>{c.name} · версия {c.current_revision_number}</option>)}</select><p className="hint">Изменения предлагаются для этого CV относительно выбранного. Обратное направление — отдельная проверка.</p></Field>}
 {mode==='vacancies'&&<p>Сохранённых вакансий: {vacancies.length}. Контекст: другие активные CV. Пакет зафиксирует версии и потребует оценку каждой вакансии.{vacancies.length>100&&' В интерфейсе до 100 вакансий; агент должен разбить полную выборку на пакеты.'}</p>}
 <label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Подтверждаю проверку выбранных CV и входов</label>
 <Problem error={mutation.error}/><div className="actions"><button disabled={!confirmed||(mode==='cv'&&!selected)||(mode==='vacancies'&&(!vacancies.length||vacancies.length>100))}>Создать проверку для агента</button>{mutation.error&&<button type="button" className="secondary" onClick={mutation.retry}>Повторить предыдущий запрос</button>}</div>
 </fieldset></form>}
 {!recommendations.length?<p className="hint">Рекомендаций пока нет. Созданный пакет ожидает явной работы агента; приложение не запускает модель в фоне.</p>:recommendations.map(rec=><article className="source" key={rec.id}><RecommendationContent rec={rec}/><Decision key={rec.id+':'+rec.version} rec={rec}/></article>)}
 <h3>История проверок</h3>{!runs.length?<p>Проверок пока нет.</p>:runs.map(run=><article className="source" key={run.id}><Link to={'/cv-reviews/'+run.id}>{kinds[run.kind]} · {states[run.state]}</Link><p>Зафиксированная ревизия {run.cv_revision_id}{run.reference_cv_id&&' → CV '+run.reference_cv_id}{run.stale&&' · устарела'}</p><Time value={run.created_at}/></article>)}
 </section>;
}
function ReviewActions({run}:{run:ReviewRun}) {
 const mutation=useMutation();
 return <><Problem error={mutation.error}/><div className="actions">{['queued','running','failed'].includes(run.state)&&<button className="secondary" disabled={mutation.pending} onClick={()=>mutation.submit('cv-review-runs/'+run.id+'/cancel','POST',{expected_version:run.version})}>Отменить проверку</button>}{run.state==='failed'&&!run.stale&&<button disabled={mutation.pending} onClick={()=>mutation.submit('cv-review-runs/'+run.id+'/retry','POST',{expected_version:run.version})}>Повторить проверку с теми же входами</button>}{mutation.error&&<button disabled={mutation.pending} className="secondary" onClick={mutation.retry}>Повторить предыдущий запрос</button>}</div></>;
}
function ReviewDetail() {
 const {packet,events}=useLoaderData<{packet:ReviewPacket;events:ReviewEvent[]}>();const run=packet.run;
 return <section className="page"><Link className="backlink" to={'/cvs/'+run.cv_id}>← CV и рекомендации</Link><div className="page-title"><div><h1>{kinds[run.kind]}</h1><p>{states[run.state]} · попытка {run.attempt_number}</p></div><Refresh/></div>
 {run.stale&&<p className="problem" role="status">Проверка содержит устаревшие входы. {run.applied?'Актуальная часть результата применена; изменённые входы сохраняются в истории.':'Результат сохранён в истории и не изменяет актуальные рекомендации.'}</p>}
 {run.state==='queued'&&<p className="hint">Ожидает агента. Попросите агента обработать эту проверку; ID: <code>{run.id}</code>. Фоновая модель не запускается.</p>}{run.error&&<p className="problem">{run.error}</p>}
 <ReviewActions key={run.id+':'+run.version} run={run}/><div className="panel"><h2>Зафиксированные входы</h2><p>Целевое CV: {packet.target_revision.name} · версия {packet.target_revision.revision_number}</p><Link to={'/cvs/'+run.cv_id+'/revisions/'+run.cv_revision_id}>Открыть целевую версию CV</Link>
 {packet.reference_revision&&<p>Сравнение с <Link to={'/cvs/'+run.reference_cv_id+'/revisions/'+run.reference_revision_id}>{packet.reference_revision.name} · версия {packet.reference_revision.revision_number}</Link></p>}
 {packet.context_revisions.length>0&&<p>Другие CV в контексте: {packet.context_revisions.map(r=>r.name+' · версия '+r.revision_number).join(', ')}</p>}
 {packet.vacancies.length>0&&<details><summary>Вакансии пакета: {packet.vacancies.length}</summary>{packet.vacancies.map(v=><p key={v.vacancy_id}><Link to={'/vacancies/'+v.vacancy_id}>{v.snapshot.title}</Link> · зафиксирована версия <Time value={v.version}/></p>)}</details>}</div>
 {run.result&&<div className="panel"><h2>Результат проверки</h2><p>Агент: {run.result.provenance.agent}; метод: {run.result.provenance.method}{run.result.provenance.model&&'; модель: '+run.result.provenance.model}</p><p>{run.applied?'Результат применён к рекомендациям.':'Результат сохранён только в истории.'}</p>{!!run.superseded_vacancy_ids?.length&&<p>По {run.superseded_vacancy_ids.length} вакансиям уже есть более новая проверка; поздние замечания по ним не заменяют новый результат.</p>}
 {run.result.findings.map(f=><article className="source" key={f.issue_key}><h3>{f.mismatch}</h3><p>{categories[f.category]}</p><p>{f.suggested_edit}</p><p>{f.rationale}</p><ul>{f.evidence.map((e,i)=><li key={i}><q>{e.quote}</q> · {e.revision_id?'CV '+e.revision_id:'вакансия '+e.vacancy_id}</li>)}</ul></article>)}
 {run.result.resolutions.map(r=><p key={r.issue_key}>Повторно проверено устранение {r.issue_key}: {r.rationale}</p>)}
 {run.result.vacancy_assessments.length>0&&<><h3>Оценки всех вакансий</h3>{run.result.vacancy_assessments.map(a=><article className="source" key={a.vacancy_id}><Link to={'/vacancies/'+a.vacancy_id}>{packet.vacancies.find(v=>v.vacancy_id===a.vacancy_id)?.snapshot.title||'Вакансия'}</Link><p>Релевантность: {relevance[a.relevance]}</p><p>{a.summary}</p><p>Пробелы: {a.issue_keys.join(', ')||'Не обнаружены'}</p></article>)}</>}
 </div>}
 <div className="panel"><h2>История состояния</h2>{events.map(e=><p key={e.id}>{states[e.snapshot.state]} · <Time value={e.created_at}/></p>)}</div></section>;
}
function RecommendationHistory() {
 const {events,cvId}=useLoaderData<{events:RecommendationEvent[];cvId:string}>();
 return <section className="page"><Link className="backlink" to={'/cvs/'+cvId}>← CV и рекомендации</Link><h1>История рекомендации</h1>{events.map(e=><article className="panel" key={e.id}><Time value={e.created_at}/><RecommendationContent rec={e.snapshot}/></article>)}</section>;
}
export const reviewRoutes=[
 {path:'cv-reviews/:id',loader:async({params,request}:LoaderFunctionArgs)=>{const[packet,events]=await Promise.all([api<{data:ReviewPacket}>('cv-review-runs/'+params.id+'/inputs',{signal:request.signal}),all<ReviewEvent>('cv-review-runs/'+params.id+'/history',request.signal)]);return {packet:packet.data,events};},Component:ReviewDetail},
 {path:'cvs/:id/recommendations/:recommendationId',loader:async({params,request}:LoaderFunctionArgs)=>{const events=await all<RecommendationEvent>('cv-recommendations/'+params.recommendationId+'/history',request.signal);if(!events.length||events.some(e=>e.snapshot.cv_id!==params.id))throw new Error('Рекомендация не принадлежит этому CV.');return {events,cvId:params.id};},Component:RecommendationHistory},
];
