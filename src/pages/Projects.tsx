import { BriefcaseBusiness, CalendarDays, HelpCircle, Home, Maximize, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { PageHeader } from '../components/PageHeader'
import { money, summarizeProject, useFinanceEvents } from '../finance'
import { useProjects } from '../projects'

export function Projects() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { projects, deleteProject } = useProjects()
  const { events } = useFinanceEvents()
  const [query, setQuery] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const canEdit = user?.role === 'organization'
  const visibleProjects = useMemo(() => projects.filter((project) => [project.name, project.shortName, project.customer].some((value) => value.toLowerCase().includes(query.toLowerCase()))), [projects, query])

  return <main className="light-page"><div className="mobile-page projects-page">
    <PageHeader title="Проекты" actions={<>{canEdit && <button className="icon-button icon-button--blue" onClick={()=>setDeleteOpen(true)} aria-label="Удалить проекты"><Trash2 /></button>}<button className="icon-button icon-button--blue" aria-label="Справка"><HelpCircle /></button></>} />
    <div className={`role-badge role-badge--${user?.role} role-badge--page`}>{canEdit ? 'Организация · редактор' : 'Клиент · просмотр'}</div>
    <label className="search-field"><Search size={24} /><input placeholder="Поиск" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    {visibleProjects.length ? <section className="projects-list"><p>Мои проекты, {visibleProjects.length}</p>{visibleProjects.map((project) => { const summary=summarizeProject(events,project.id);return <button className="project-card" key={project.id} onClick={() => navigate(`/projects/${project.id}`)}><div><strong>{project.name}</strong><span><Home />{project.shortName}</span><span><BriefcaseBusiness />{project.customer}</span><span><CalendarDays />{formatDate(project.completionDate)}</span><span><Maximize />{project.area} м²</span></div><div className="project-balance"><span>Баланс</span><strong>{money(summary.balance)}</strong></div></button>})}</section> : <p className="empty-state">Нет доступных для просмотра проектов{canEdit && <>.<br />Необходимо их добавить</>}</p>}
    {canEdit && <button className="fab fab--page" onClick={() => navigate('/projects/new')} aria-label="Создать проект"><Home /><span className="fab-mini-plus">+</span></button>}
    {deleteOpen&&<div className="sheet-backdrop" onClick={()=>setDeleteOpen(false)}><section className="project-delete-sheet" onClick={event=>event.stopPropagation()}><div className="sheet-heading"><h2>Удалить проект</h2><button className="icon-button" onClick={()=>setDeleteOpen(false)} aria-label="Закрыть"><X/></button></div><p>Выберите проект. Финансовые события останутся в истории.</p>{projects.length?<div>{projects.map(project=><article key={project.id}><span><strong>{project.name}</strong><small>{project.customer||'Заказчик не указан'}</small></span><button type="button" onClick={()=>{if(window.confirm(`Удалить проект «${project.name}»?`))deleteProject(project.id)}} aria-label={`Удалить проект ${project.name}`}><Trash2/></button></article>)}</div>:<p className="empty-state">Проектов нет</p>}</section></div>}
  </div></main>
}

function formatDate(value: string) { const [year, month, day] = value.split('-'); return year && month && day ? `${day}.${month}.${year}` : value }
