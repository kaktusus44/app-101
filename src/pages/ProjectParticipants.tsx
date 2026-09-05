import { Check, ChevronRight, Plus, Search, UserRound, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { PageHeader } from '../components/PageHeader'
import { categoryLabels, useCounterparties, type Counterparty } from '../counterparties'
import { useProjects } from '../projects'

type Participant = { id:string; name:string; caption:string; system:boolean; route:string }

export function ProjectParticipants(){
  const {projectId=''}=useParams();const navigate=useNavigate();const {user}=useAuth();const {projects,loading,updateProject}=useProjects();const {counterparties}=useCounterparties();const project=projects.find(item=>item.id===projectId);const [pickerOpen,setPickerOpen]=useState(false);const [query,setQuery]=useState('');const canEdit=user?.role==='organization'
  const participants=useMemo<Participant[]>(()=>{
    if(!project)return[]
    const result=new Map<string,Participant>()
    if(user)result.set(user.id,{id:user.id,name:user.name,caption:'Организация · руководитель проекта',system:true,route:'/counterparties/me'})
    const add=(person:Counterparty,caption:string,system:boolean)=>result.set(person.id,{id:person.id,name:person.name,caption,system,route:`/counterparties/${person.id}`})
    const customer=counterparties.find(item=>item.id===project.customerId)||counterparties.find(item=>normalize(item.name)===normalize(project.customer))
    if(customer)add(customer,'Заказчик',true)
    for(const share of project.agentFeeShares||[]){const person=counterparties.find(item=>item.id===share.recipientId);if(person)add(person,'Получатель агентского вознаграждения',true)}
    for(const id of project.participantIds||[]){const person=counterparties.find(item=>item.id===id);if(person&&!result.has(id))add(person,categoryLabels[person.category],false)}
    return [...result.values()]
  },[project,counterparties,user])
  const selectedIds=new Set(participants.map(item=>item.id));const candidates=counterparties.filter(item=>`${item.name} ${categoryLabels[item.category]}`.toLowerCase().includes(query.toLowerCase()))
  if(loading)return <main className="light-page"><div className="mobile-page"><p className="empty-state">Загрузка проекта…</p></div></main>
  if(!project)return <Navigate to="/projects" replace/>
  function toggle(person:Counterparty){const ids=project!.participantIds||[];const selected=ids.includes(person.id);const customer=person.id===project!.customerId||normalize(person.name)===normalize(project!.customer);const fee=(project!.agentFeeShares||[]).some(item=>item.recipientId===person.id);if(selected&&!customer&&!fee)save(ids.filter(id=>id!==person.id));else if(!selected&&!customer&&!fee)save([...ids,person.id])}
  function save(participantIds:string[]){const {id,balance:_,income:__,expense:___,...editable}=project!;updateProject(id,{...editable,participantIds})}
  return <main className="light-page"><div className="mobile-page project-participants-page"><PageHeader title="Участники"/><p className="participants-project">{project.name}</p><section className="participants-list">{participants.map(item=><button key={item.id} onClick={()=>navigate(item.route)}><UserRound/><span><strong>{item.name}</strong><small>{item.caption}{item.system?' · добавлен автоматически':''}</small></span><ChevronRight/></button>)}</section>{!participants.length&&<p className="empty-state">Участников пока нет</p>}{canEdit&&<button className="primary-button participants-add" onClick={()=>setPickerOpen(true)}><Plus/>Добавить участников</button>}{pickerOpen&&<div className="sheet-backdrop" onClick={()=>setPickerOpen(false)}><section className="participants-picker" onClick={event=>event.stopPropagation()}><div className="sheet-heading"><h2>Участники проекта</h2><button className="icon-button" onClick={()=>setPickerOpen(false)} aria-label="Закрыть"><X/></button></div><label className="search-field"><Search/><input placeholder="Поиск" value={query} onChange={event=>setQuery(event.target.value)}/></label><div>{candidates.map(person=>{const selected=selectedIds.has(person.id);const locked=person.id===project.customerId||normalize(person.name)===normalize(project.customer)||(project.agentFeeShares||[]).some(item=>item.recipientId===person.id);return <button key={person.id} onClick={()=>toggle(person)}><Users/><span><strong>{person.name}</strong><small>{categoryLabels[person.category]}{locked?' · связан с проектом':''}</small></span><i className={selected?'is-selected':''}>{selected&&<Check/>}</i></button>})}</div><button className="primary-button" onClick={()=>setPickerOpen(false)}>Готово</button></section></div>}</div></main>
}

function normalize(value:string){return value.toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
