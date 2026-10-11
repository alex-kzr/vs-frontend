import { cvRoutes } from './cvs';
import { matchingRoutes } from './matching';
import { previewLoader } from './preview';
import { createBrowserRouter, redirect, type LoaderFunctionArgs } from 'react-router';
import { api,all } from './api';
import type { Company, Configuration, Contact, Conversation, Lookup, Vacancy, Page, Discovery, Message, StatusChange } from './types';
import { Layout, RouteFailure, ListScreen, DetailScreen } from './screens';
import { EntryScreen } from './forms';
import { mutationAction } from './ui';

export const resources=['vacancies','search-configurations','companies','contacts','conversations'] as const;
export type Resource=typeof resources[number];
export type Entity=Vacancy|Configuration|Company|Contact|Conversation;
export const names:Record<Resource,string>={vacancies:'Вакансии','search-configurations':'Профили поиска',companies:'Компании',contacts:'Контакты',conversations:'Переписки'};
export interface RouteData {
 resource:Resource;record?:Entity;page?:Page<Entity>;companies:Company[];configs:Configuration[];contacts:Contact[];vacancies:Vacancy[];sources:Lookup[];channels:Lookup[];roles:Lookup[];
 discoveries?:Page<Discovery>;messages?:Page<Message>;panelError?:string;statusHistory?:StatusChange[];statusHistoryError?:string
}
async function lookups(resource:Resource,signal:AbortSignal,full=false) {
 const [companies,configs,contacts,vacancies,sources,channels,roles]=await Promise.all([
  resource!=='companies'||full?all<Company>('companies',signal):Promise.resolve([]),
  resource==='vacancies'?all<Configuration>('search-configurations',signal):Promise.resolve([]),
  resource==='conversations'&&full?all<Contact>('contacts',signal):Promise.resolve([]),
  resource==='conversations'&&full?all<Vacancy>('vacancies',signal):Promise.resolve([]),
  resource==='vacancies'?all<Lookup>('vacancy-sources',signal):Promise.resolve([]),
  resource==='conversations'?all<Lookup>('communication-channels',signal):Promise.resolve([]),
  resource==='contacts'?all<Lookup>('contact-roles',signal):Promise.resolve([]),
 ]);
 return {companies,configs,contacts,vacancies,sources,channels,roles};
}
function listLoader(resource:Resource) {return async ({request}:LoaderFunctionArgs):Promise<RouteData>=>{
 const search=new URL(request.url).search;
 const [page,refs]=await Promise.all([api<Page<Entity>>(resource+search,{signal:request.signal}),lookups(resource,request.signal)]);
 return {resource,page,...refs};
};}
function entryLoader(resource:Resource) {return async ({params,request}:LoaderFunctionArgs):Promise<RouteData>=>{
 const [record,refs]=await Promise.all([params.id?api<{data:Entity}>(resource+'/'+params.id,{signal:request.signal}).then(r=>r.data):Promise.resolve(undefined),lookups(resource,request.signal,true)]);
 return {resource,record,...refs};
};}
function detailLoader(resource:Resource) {return async ({params,request}:LoaderFunctionArgs):Promise<RouteData>=>{
 const record=await api<{data:Entity}>(resource+'/'+params.id,{signal:request.signal});
 const refs=await lookups(resource,request.signal,resource==='conversations');
 let panel:Partial<RouteData>={};
 const search=new URL(request.url).search;
 try {
  if(resource==='vacancies')panel={discoveries:await api<Page<Discovery>>(resource+'/'+params.id+'/discoveries'+search,{signal:request.signal})};
  if(resource==='conversations')panel={messages:await api<Page<Message>>(resource+'/'+params.id+'/messages'+search,{signal:request.signal})};
 }catch(e){if(e instanceof DOMException&&e.name==='AbortError')throw e;panel={panelError:'Не удалось загрузить историю. Нажмите «Обновить», чтобы повторить.'};}
 if(resource==='vacancies') {
  try {panel.statusHistory=await all<StatusChange>(resource+'/'+params.id+'/status-history',request.signal);}
  catch(e){if(e instanceof DOMException&&e.name==='AbortError')throw e;panel.statusHistoryError='Не удалось загрузить историю статусов. Нажмите «Обновить», чтобы повторить.';}
 }
 return {resource,record:record.data,...refs,...panel};
};}
export const router=createBrowserRouter([{path:'/',Component:Layout,children:[
 {index:true,loader:()=>redirect('/vacancies')},
 {path:'_mutate',action:mutationAction}, {path:'search-configurations/:id/preview',loader:({params,request})=>previewLoader(params.id!,request.signal)},
 ...resources.flatMap(resource=>[
  {path:resource,loader:listLoader(resource),Component:ListScreen,ErrorBoundary:RouteFailure},
  {path:resource+'/new',loader:entryLoader(resource),Component:EntryScreen,ErrorBoundary:RouteFailure},
  {path:resource+'/:id',loader:detailLoader(resource),Component:DetailScreen,ErrorBoundary:RouteFailure},
  ...(resource!=='vacancies'&&resource!=='conversations'?[{path:resource+'/:id/edit',loader:entryLoader(resource),Component:EntryScreen,ErrorBoundary:RouteFailure}]:[]),
 ]),
 ...[...cvRoutes,...matchingRoutes].map(route=>({...route,ErrorBoundary:RouteFailure})),
 {path:'*',Component:()=> <section><h1>Страница не найдена</h1><a href="/vacancies">Вернуться к вакансиям</a></section>},
]}]);
