import { BarChart3, BookOpen, CalendarDays, ChevronRight, CircleDollarSign, FileText, Images, List, MapPin, Maximize, Pencil, Table2, UserRound, Users } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth'
import { useCounterparties } from '../counterparties'
import { PageHeader } from '../components/PageHeader'
import { EventCreateMenu } from '../components/EventCreateMenu'
import { money, summarizeProject, useFinanceEvents } from '../finance'
import { useProjects } from '../projects'

const sections = [
  { label: 'События', icon: List }, { label: 'Статьи расходов', icon: BarChart3 },
  { label: 'Участники', icon: Users }, { label: 'Документы', icon: FileText },
  { label: 'Прайс-лист', icon: Table2, caption: 'Не выбран' },
  { label: 'Получатели агентского вознаграждения', icon: CircleDollarSign },
  { label: 'Партнёры', icon: Users }, { label: 'Руководитель проекта', icon: UserRound },
]

export function ProjectDetails() {
  const { projectId = '' } = useParams(); const navigate = useNavigate(); const { user } = useAuth(); const { projects } = useProjects(); const { counterparties } = useCounterparties()
  const [menuOpen,setMenuOpen]=useState(false)
  const { events } = useFinanceEvents()
  const project = projects.find((candidate) => candidate.id === projectId); const canEdit = user?.role === 'organization'; const customerName=normalizeName(project?.customer??'');const customer=project&&counterparties.find(item=>item.id===project.customerId)||counterparties.find(item=>normalizeName(item.name)===customerName)||counterparties.find(item=>normalizeName(item.name).includes(customerName)||customerName.includes(normalizeName(item.name)))
  if (!project) return <Navigate to="/projects" replace />
  const finances = summarizeProject(events, project.id)
  return <><main className="light-page"><div className="mobile-page project-details-page">
    <PageHeader title="" actions={canEdit ? <button className="icon-button icon-button--blue" onClick={() => navigate(`/projects/${project.id}/edit`)} aria-label="Редактировать проект"><Pencil /></button> : undefined} />
    <section className="project-summary"><h1>{project.name}</h1><strong>{project.shortName}</strong><button className="project-customer-link" onClick={()=>customer&&navigate(`/counterparties/${customer.id}`)} disabled={!customer}><UserRound />{project.customer}<ChevronRight /></button><p><CalendarDays />{formatDate(project.completionDate)}</p><p><Maximize />{project.area} м²</p><p><MapPin />{project.address}</p></section>
    <section className="finance-summary"><span>Баланс <b>{money(finances.balance)}</b></span><span>Поступление <b>{money(finances.income)}</b></span><span>Расход <b>{money(finances.expense)}</b></span></section>
    <section className="project-menu">{sections.slice(0, 3).map((section) => renderSection(section, section.label === 'События' ? () => navigate(`/events?projectId=${encodeURIComponent(project.id)}`) : section.label === 'Статьи расходов' ? () => navigate(`/projects/${project.id}/expense-articles`) : undefined))}<button onClick={() => project.photoAlbumUrl && window.open(project.photoAlbumUrl, '_blank', 'noopener,noreferrer')}><Images /><span>Общий фотоальбом<small>{project.photoAlbumUrl ? 'Открыть альбом' : 'Ещё не добавлена'}</small></span><ChevronRight /></button><button onClick={() => navigate('/projects/photo-album-help')}><BookOpen /><span>Как настроить фотоальбом<small>Android и iOS</small></span><ChevronRight /></button>{sections.slice(3).map((section) => renderSection(section, section.label === 'Документы' ? () => navigate(`/projects/${project.id}/documents`) : section.label === 'Получатели агентского вознаграждения'?()=>navigate(`/projects/${project.id}/agent-fee-recipients`):undefined))}</section>
    {canEdit && <button className="fab fab--page" onClick={()=>setMenuOpen(true)} aria-label="Добавить событие">+</button>}
  </div></main>
  <EventCreateMenu open={menuOpen} onClose={()=>setMenuOpen(false)} returnTo={`/projects/${project.id}`} projectId={project.id}/>
  </>
}
function renderSection({ label, icon: Icon, caption }: typeof sections[number], onClick?: () => void) { return <button key={label} onClick={onClick}><Icon /><span>{label}{caption && <small>{caption}</small>}</span><ChevronRight /></button> }
function formatDate(value: string) { const [year, month, day] = value.split('-'); return year && month && day ? `${day}.${month}.${year}` : value }
function normalizeName(value:string){return value.toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
