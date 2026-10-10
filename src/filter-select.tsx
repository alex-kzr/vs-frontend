import { useId, useState, type KeyboardEvent } from 'react';

interface FilterChoice { id:string; label:string }
interface FilterProps {
 label:string; name:string; options:readonly FilterChoice[]; selected:readonly string[];
}
type BaseProps=FilterProps & ({variant:'checkboxes'}|{variant:'searchable';searchLabel:string});

function CheckboxFilterBase(props:BaseProps) {
 const {label,name,options}=props;
 const id=useId();
 const [selected,setSelected]=useState(()=>new Set(props.selected));
 const [query,setQuery]=useState('');
 const [open,setOpen]=useState(false);
 const selectedLabels=[...selected].map(value=>options.find(option=>option.id===value)?.label||'Неизвестное значение');
 const summary=selected.size===0?'Все':selected.size===1?selectedLabels[0]:'Выбрано: '+selected.size;
 const visible=options.filter(option=>option.label.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
 function toggle(value:string) {
  setSelected(previous=>{const next=new Set(previous);if(next.has(value))next.delete(value);else next.add(value);return next;});
 }
 function closeOnEscape(event:KeyboardEvent<HTMLDetailsElement>) {
  if(event.key==='Escape') {
   event.currentTarget.open=false;
   event.currentTarget.querySelector('summary')?.focus();
   event.preventDefault();
  }
 }
 return <div className="checkbox-filter">
  <span className="filter-caption" id={id+'-caption'}>{label}</span>
  {[...selected].sort().map(value=><input key={value} type="hidden" name={name} value={value}/>)}
  <details name="list-filters" className="filter-disclosure" onKeyDown={closeOnEscape} onToggle={event=>setOpen(event.currentTarget.open)}>
   <summary role="button" aria-expanded={open} aria-controls={id+'-options'} aria-label={label+': '+summary} title={selectedLabels.join(', ')||'Все значения'}>
    <span className="filter-summary-text">{summary}</span><span aria-hidden="true">▾</span>
   </summary>
   <div className="filter-popover" id={id+'-options'}>
    <div className="filter-selection"><span>{selected.size?'Выбрано: '+selected.size:'Нет выбора — все значения'}</span>
     <button type="button" className="secondary filter-clear" disabled={!selected.size} onClick={()=>setSelected(new Set())}>Очистить выбор</button>
    </div>
    {props.variant==='searchable'&&<label className="field filter-search" htmlFor={id+'-search'}><span>{props.searchLabel}</span>
     <input id={id+'-search'} type="search" autoComplete="off" placeholder="Название компании…" value={query} onChange={event=>setQuery(event.currentTarget.value)}/>
    </label>}
    <fieldset className="filter-options" aria-labelledby={id+'-caption'}>
     {visible.map(option=><label className="filter-option" key={option.id}>
      <input type="checkbox" checked={selected.has(option.id)} onChange={()=>toggle(option.id)}/><span>{option.label}</span>
     </label>)}
     {visible.length===0&&<p className="filter-no-results">Ничего не найдено. Измените поиск.</p>}
    </fieldset>
   </div>
  </details>
  {selected.size>1&&<small className="filter-selected-names" title={selectedLabels.join(', ')}>{selectedLabels.join(', ')}</small>}
 </div>;
}
export function CheckboxFilter(props:FilterProps) {
 return <CheckboxFilterBase {...props} variant="checkboxes"/>;
}
export function SearchableCheckboxFilter(props:FilterProps & {searchLabel:string}) {
 return <CheckboxFilterBase {...props} variant="searchable"/>;
}
