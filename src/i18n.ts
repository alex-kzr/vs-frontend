import type { ApiProblem, Lookup } from './types';

export const statuses=['new','saved','contacted','declined_by_applicant','rejected_by_employer','rejected','archived'] as const;
const values:Record<string,string>={
 new:'Новая',saved:'Сохранена',contacted:'Связался',declined_by_applicant:'Я отказался',rejected_by_employer:'Работодатель отказал',rejected:'Отказ — сторона не указана',archived:'В архиве',
 remote:'Удалённо',hybrid:'Гибридный формат',onsite:'В офисе',full_time:'Полная занятость',part_time:'Частичная занятость',contract:'По договору',internship:'Стажировка',temporary:'Временная работа',
 inbound:'Входящее',outbound:'Исходящее',user:'Я',contact:'Контакт',unknown:'Участник без контакта',
 ON_SITE:'В офисе',REMOTE:'Удалённо',HYBRID:'Гибридный формат',FIELD_WORK:'Разъездная работа',noExperience:'Без опыта',between1And3:'От 1 до 3 лет',between3And6:'От 3 до 6 лет',moreThan6:'Более 6 лет',
 FULL:'Полная занятость',PART:'Частичная занятость',PROJECT:'Проектная работа',FLY_IN_FLY_OUT:'Вахта',
 MONTH:'В месяц',YEAR:'В год',HOUR:'В час',DAY:'В день',WEEK:'В неделю',
};
export function valueLabel(value:string|null|undefined) {return value?values[value]||value:'Не указано';}
export function statusChoices(current?:string) {return statuses.filter(value=>value!=='rejected'||current==='rejected').map(id=>({id,label:valueLabel(id)}));}
const fields:Record<string,string>={
 expected_version:'Версия состояния', reference_cv_id:'CV сравнения', expected_reference_revision_id:'Версия CV сравнения', category:'Категория замечания', evidence:'Доказательства', resolutions:'Подтверждённые исправления', issue_key:'Ключ замечания', findings:'Замечания', vacancy_assessments:'Оценки вакансий', vacancy_version:'Версия вакансии', context_cvs:'Другие CV',
 source_code:'Источник CV',source_url:'Ссылка источника',external_id:'Внешний ID CV',expected_lifecycle_version:'Состояние CV',
 body:'Текст',name:'Название',title:'Название вакансии',description:'Описание',status:'Статус',notes:'Заметки',company_id:'Компания',website:'Сайт',role:'Должность',
 keywords:'Ключевые слова',excluded_keywords:'Исключённые слова',locations:'Местоположения',technologies:'Технологии',work_formats:'Форматы работы',employment_types:'Виды занятости',
 queries:'Запросы в браузере',criteria:'Критерии',criteria_version:'Версия критериев',enabled:'Доступность',display_name:'Имя',email:'Электронная почта',profile_url:'Ссылка на профиль',role_ids:'Роли',
 location:'Местоположение',work_format:'Формат работы',employment_type:'Вид занятости',salary_min:'Минимальная зарплата',salary_max:'Максимальная зарплата',salary_currency:'Валюта',public_url:'Публичная ссылка',
 source_id:'Источник',external_vacancy_id:'ID вакансии в источнике',external_url:'Ссылка в источнике',target_vacancy_id:'Целевая вакансия',observation:'Обнаружение',observation_key:'Ключ обнаружения',observed_at:'Дата обнаружения',search_configuration_id:'Профиль поиска',
 vacancy_id:'Вакансия',channel_id:'Канал',subject:'Тема',participants:'Участники',participant_kind:'Тип участника',participant_key:'Ключ участника',contact_id:'Контакт',participant_label:'Имя участника',
 sender_participant_id:'Отправитель',direction:'Направление',occurred_at:'Дата сообщения',external_message_id:'ID сообщения в источнике',client_message_id:'Ключ сообщения',external_conversation_id:'ID переписки в источнике',
 hh:'Критерии HH',hh_text:'Запрос HH',text:'Запрос',areas:'Регионы',experience:'Опыт',employment_forms:'Занятость',period_days:'Период публикации',per_page:'Записей на странице',relationship:'Связь записей','Idempotency-Key':'Ключ повторного запроса',
};
export function fieldLabel(field:string) {return fields[field]||fields[field.split('.').at(-1)||'']||'Поле «'+field+'»';}

const systemLabels:Record<string,[string,string]>={
 manual:['Manual','Вручную'], 'fixture-v1':['Synthetic fixture (offline)','Тестовые вакансии (без сети)'],
 hh:['hh.ru (official API; access setup required)','hh.ru (официальный API; требуется настройка)'],
 'hh-browser':['hh.ru (user-directed browser review)','hh.ru (просмотр в браузере по поручению пользователя)'],
 recruiter:['Recruiter','Рекрутер'],hiring_manager:['Hiring manager','Руководитель найма'],developer:['Developer','Разработчик'],other:['Other','Другая роль'],
 hr:['HR','Специалист по персоналу'],project_manager:['Project manager','Руководитель проекта'],product_manager:['Product manager','Менеджер продукта'],team_lead:['Team lead','Руководитель команды'],
};
export function lookupLabel(lookup:Lookup|undefined) {
 if(!lookup)return 'Не указано';
 const original=lookup.label||lookup.name||lookup.code;
 if(lookup.code==='manual'&&original==='Manual record')return 'Ручная запись';
 const known=systemLabels[lookup.code];
 return known&&original===known[0]?known[1]:original;
}

const messages:Record<string,string>={
 'Required text.':'Заполните обязательное поле.',
 'Expected an object.':'Ожидается объект с полями.',
 'Unknown field.':'Неизвестное поле.',
 'Text is empty or exceeds the allowed length.':'Текст пуст или превышает допустимую длину.',
 'Expected a UUID.':'Укажите корректный UUID.',
 'Expected an ID.':'Укажите идентификатор записи.',
 'Expected a boolean.':'Выберите да или нет.',
 'Unsupported value.':'Выберите допустимое значение.',
 'Unsupported status.':'Выберите допустимый статус вакансии.',
 'Use RFC3339 with a timezone offset.':'Укажите дату и время с часовым поясом.',
 'Precision beyond milliseconds is unsupported.':'Допустима точность до миллисекунд.',
 'Use an absolute HTTP(S) URL without credentials.':'Укажите полный адрес HTTP(S) без логина и пароля.',
 'Invalid URL.':'Некорректная ссылка.',
 'Absolute URL required.':'Укажите полный адрес.',
 'Credentials are unsupported.':'Логин и пароль в ссылке недопустимы.',
 'Invalid email.':'Некорректный адрес электронной почты.',
 'Expected an array.':'Ожидается список.',
 'At most 50 values.':'Допускается не более 50 значений.',
 'Expected text values.':'Ожидаются текстовые значения.',
 'Values must be distinct, non-empty and supported.':'Значения должны быть непустыми, различными и допустимыми.',
 'Use a non-negative safe integer in minor units.':'Укажите неотрицательное целое число в минимальных единицах валюты.',
 'Must be at least salary_min.':'Максимум не может быть меньше минимума.',
 'Three uppercase currency letters required with a salary.':'Для зарплаты укажите код валюты из трёх заглавных латинских букв.',
 'Referenced record does not exist.':'Связанная запись не существует.',
 'Invalid relationship or value.':'Некорректная связь записей или значение.',
 'Supply at least one field.':'Укажите хотя бы одно поле.',
 'A client UUID is required.':'Требуется UUID для безопасного повторного запроса.',
"A stable client UUID or external ID is required.":"Требуется постоянный UUID сообщения или ID в источнике.",
"At most 100 participants.":"Допускается не более 100 участников.",
"Browser review exceeds 32 KiB.":"Данные просмотра в браузере превышают 32 КиБ.",
"Browser review provenance is required for this source.":"Для этого источника требуются данные просмотра в браузере.",
"Browser review requires its canonical URL; relevant reviews require remote format.":"Укажите каноническую ссылку HH; для подходящей вакансии требуется удалённый формат.",
"Choose at most 10 regions.":"Выберите не более 10 регионов.",
"Contact ID required only for contact participants.":"ID контакта требуется только для участника типа «Контакт».",
"Contact does not exist.":"Контакт не существует.",
"Contact must belong to the conversation company.":"Контакт должен относиться к компании этой переписки.",
"Duplicate participant key.":"Ключ участника повторяется.",
"Duplicate role.":"Роль повторяется.",
"Edit this configuration and add an HH search query.":"Измените профиль и добавьте запрос HH.",
"Enter your own HH query before searching.":"Перед поиском введите свой запрос HH.",
"Expected a numeric HH vacancy ID.":"Укажите числовой ID вакансии HH.",
"Expected hh-browser.":"Требуется источник просмотра HH в браузере.",
"Expected relevant or needs_review.":"Укажите классификацию «Подходит» или «Требует проверки».",
"Expected up to 100 distinct role IDs.":"Допускается не более 100 разных ID ролей.",
"Invalid HH provenance metadata.":"Некорректные исходные данные HH.",
"Invalid HH work formats.":"Некорректные форматы работы HH.",
"Label required for unknown participant.":"Для участника без контакта требуется имя.",
"Metadata exceeds 32 KiB.":"Исходные данные превышают 32 КиБ.",
"Metadata must match the declared source and vacancy ID.":"Исходные данные должны соответствовать источнику и ID вакансии.",
"Provide an external ID or URL.":"Укажите ID или ссылку в источнике.",
"Record at least one query used for this review.":"Укажите хотя бы один запрос, использованный для просмотра.",
"Required message text, up to 100000 characters.":"Введите текст сообщения длиной до 100 000 символов.",
"Select 1-100 participants.":"Добавьте от 1 до 100 участников.",
"Sender does not exist.":"Отправитель не существует.",
"Sender must belong to this conversation and match the direction.":"Отправитель должен участвовать в этой переписке и соответствовать направлению сообщения.",
"Target must belong to the same company.":"Целевая вакансия должна относиться к той же компании.",
"Target vacancy does not exist.":"Целевая вакансия не существует.",
"Unsupported participant kind.":"Выберите допустимый тип участника.",
"Unsupported provenance provider.":"Источник исходных данных не поддерживается.",
"Use 1-30 days or leave empty.":"Укажите от 1 до 30 дней или оставьте поле пустым.",
"Use YYYY-MM-DD.":"Используйте формат даты ГГГГ-ММ-ДД.",
"Use an integer from 1 to 50.":"Укажите целое число от 1 до 50.",
"Use inbound or outbound.":"Выберите «Входящее» или «Исходящее».",
"Use the canonical HH vacancy URL matching its ID.":"Укажите каноническую ссылку HH, соответствующую ID вакансии.",
"Use unique numeric HH region IDs.":"ID регионов HH должны быть числовыми и не повторяться.",
"Vacancy does not exist.":"Вакансия не существует.",
"Vacancy must belong to the company.":"Вакансия должна относиться к выбранной компании.",
};
export function fieldMessage(message:string) {return messages[message]||(/[А-Яа-яЁё]/.test(message)?message:'Проверьте значение, формат и связи этого поля.');}
const errors:Record<string,string>={
 cv_revision_conflict:'Текущая версия CV изменилась. Обновите страницу и проверьте изменения перед созданием новой версии или пакета.',
 cv_deleted:'CV удалено. Сначала восстановите его в разделе «Удалённые CV», затем обновите страницу.',
 cv_deleted_duplicate_source:'Это CV уже сохранено и удалено. Восстановите существующее CV в разделе «Удалённые CV»; повторный импорт не создаёт дубль.',
 cv_duplicate_source:'CV из этого источника с той же ссылкой или внешним ID уже существует. Откройте его для создания новой версии.',
 cv_lifecycle_conflict:'Состояние CV уже изменилось. Обновите страницу и проверьте, активно оно или удалено.',
 cv_duplicate_url:'Это резюме HH уже связано с другим CV. Откройте существующее CV и создайте новую версию.',
 review_version_conflict:'Состояние проверки изменилось. Обновите страницу.',
 review_attempt_conflict:'Попытка проверки изменилась. Получите актуальные входы.',
 review_state_conflict:'Проверка завершена или её состояние изменилось. Обновите страницу.',
 review_stale:'Входы изменились. Создайте новую проверку текущих версий.',
 recommendation_version_conflict:'Рекомендация или решение изменились. Обновите страницу перед сохранением.',
 recommendation_resolved:'Устранение уже подтверждено повторной проверкой.',
 vacancy_version_conflict:'Вакансия изменилась. Обновите страницу и создайте новый пакет.',
 matching_agent_conflict:'Источник результата не соответствует агенту, который получил задание. Проверьте имя агента и текущую попытку.',
 matching_input_conflict:'Попытка или версия CV не соответствует пакету. Загрузите актуальные входы задания.',
 matching_state_conflict:'Состояние пакета или задания уже изменилось. Обновите страницу; поздний ответ отменённой попытки не сохраняется.',
 validation_failed:'Некоторые поля заполнены неверно.',not_found:'Запись не найдена.',internal_error:'Не удалось выполнить операцию. Повторите запрос позже.',
 database_busy:'База данных занята. Повторите тот же запрос.',network_error:'Соединение потеряно. Черновик сохранён; повторите тот же запрос.',
 unconfirmed_submission:'Предыдущее сохранение не подтверждено. Сначала повторите его без изменений.',
 invalid_response:'Сервер вернул некорректный ответ. Повторите тот же запрос.',invalid_query:'Некорректные параметры списка. Сбросьте фильтры.',invalid_cursor:'Параметры страницы устарели или не соответствуют фильтрам. Откройте первую страницу.',
 invalid_host:'Откройте настроенный локальный адрес.',invalid_origin:'Запрос с этого адреса не разрешён.',method_not_allowed:'Этот способ запроса не поддерживается.',unsupported_media_type:'Запрос должен содержать JSON.',payload_too_large:'Запрос превышает допустимый размер.',invalid_json:'Некорректные данные JSON.',
 hh_setup_required:'Требуется разрешённый доступ к API HH. Настройте его локально по инструкции.',hh_cancelled:'Просмотр отменён. Вакансии не импортированы.',
 hh_busy:'Другой запрос HH ещё выполняется. Дождитесь завершения или отмените его.',hh_rate_limited:'HH ограничил частоту запросов. Дождитесь указанного времени.',
 hh_access_denied:'HH не разрешил доступ или требует проверки. Проверьте настройку приложения; проверку на HH выполните самостоятельно.',
 hh_invalid_criteria:'HH не принял параметры поиска. Проверьте запрос и регионы.',hh_unavailable:'HH недоступен. Повторите запрос вручную позже.',hh_response_too_large:'Ответ HH превышает допустимый размер.',
 hh_invalid_response:'HH вернул некорректный ответ. Вакансии не импортированы.',hh_timeout:'Время ожидания HH истекло. Вакансии не импортированы; повторите вручную или уменьшите размер страницы.',hh_network_error:'Не удалось подключиться к HH. Проверьте соединение и повторите вручную.',
};
export function problemMessage(problem:ApiProblem) {
 if(/[А-Яа-яЁё]/.test(problem.message))return problem.message;
 return errors[problem.code]||(problem.code.includes('conflict')?'Эти данные уже используются другой записью. Проверьте существующую запись.':'Не удалось выполнить операцию. Повторите запрос вручную.');
}
