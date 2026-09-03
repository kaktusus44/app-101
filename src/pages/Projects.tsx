import { Archive, BriefcaseBusiness, CalendarDays, HelpCircle, Home, Maximize, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { PageHeader } from '../components/PageHeader'
import { useProjects } from '../projects'

export function Projects() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { projects } = useProjects()
  const [query, setQuery] = useState('')
  const canEdit = user?.role === 'organization'
  const visibleProjects = useMemo(() => projects.filter((project) => [project.name, project.shortName, project.customer].some((value) => value.toLowerCase().includes(query.toLowerCase()))), [projects, query])

  return <main className="light-page"><div className="mobile-page projects-page">
    <PageHeader title="Проекты" actions={<>{canEdit && <button className="icon-button icon-button--blue" aria-label="Архив"><Archive /></button>}<button className="icon-button icon-button--blue" aria-label="Справка"><HelpCircle /></button></>} />
    <div className={`role-badge role-badge--${user?.role} role-badge--page`}>{canEdit ? 'Организация · редактор' : 'Клиент · просмотр'}</div>
    <label className="search-field"><Search size={24} /><input placeholder="Поиск" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    {visibleProjects.length ? <section className="projects-list"><p>Мои проекты, {visibleProjects.length}</p>{visibleProjects.map((project) => <button className="project-card" key={project.id} onClick={() => navigate(`/projects/${project.id}`)}><div><strong>{project.name}</strong><span><Home />{project.shortName}</span><span><BriefcaseBusiness />{project.customer}</span><span><CalendarDays />{formatDate(project.completionDate)}</span><span><Maximize />{project.area} м²</span></div><div className="project-balance"><span>Баланс</span><strong>{project.balance}</strong></div></button>)}</section> : <p className="empty-state">Нет доступных для просмотра проектов{canEdit && <>.<br />Необходимо их добавить</>}</p>}
    {canEdit && <button className="fab fab--page" onClick={() => navigate('/projects/new')} aria-label="Создать проект"><Home /><span className="fab-mini-plus">+</span></button>}
  </div></main>
}

function formatDate(value: string) { const [year, month, day] = value.split('-'); return year && month && day ? `${day}.${month}.${year}` : value }
