import { BarChart3, CalendarDays, ChevronRight, CircleDollarSign, FileText, Images, List, MapPin, Maximize, MoreHorizontal, Table2, UserRound, Users } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { PageHeader } from '../components/PageHeader'
import { useProjects } from '../projects'

const sections = [
  { label: 'События', icon: List },
  { label: 'Статьи расходов', icon: BarChart3 },
  { label: 'Участники', icon: Users },
  { label: 'Документы', icon: FileText },
  { label: 'Прайс-лист', icon: Table2, caption: 'Не выбран' },
  { label: 'Получатели агентского вознаграждения', icon: CircleDollarSign },
  { label: 'Партнёры', icon: Users },
  { label: 'Руководитель проекта', icon: UserRound },
]

export function ProjectDetails() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { projects } = useProjects()
  const project = projects.find((candidate) => candidate.id === projectId)
  const canEdit = user?.role === 'organization'
  if (!project) return <Navigate to="/projects" replace />
  return <main className="light-page"><div className="mobile-page project-details-page"><PageHeader title="" actions={canEdit ? <button className="icon-button icon-button--blue" aria-label="Действия"><MoreHorizontal /></button> : undefined} /><section className="project-summary"><h1>{project.name}</h1><strong>{project.shortName}</strong><p><UserRound />{project.customer}<ChevronRight /></p><p><CalendarDays />{formatDate(project.completionDate)}</p><p><Maximize />{project.area} м²</p><p><MapPin />{project.address}</p></section><section className="finance-summary"><span>Баланс <b>{project.balance}</b></span><span>Поступление <b>{project.income}</b></span><span>Расход <b>{project.expense}</b></span></section><section className="project-menu">{sections.slice(0, 3).map(renderSection)}<button onClick={() => project.photoAlbumUrl && window.open(project.photoAlbumUrl, '_blank')}><Images /><span>Общий фотоальбом<small>{project.photoAlbumUrl ? 'Открыть альбом' : 'Ещё не добавлена'}</small></span><ChevronRight /></button>{sections.slice(3).map(renderSection)}</section>{canEdit && <button className="fab fab--page" aria-label="Добавить событие">+</button>}</div></main>
}

function renderSection({ label, icon: Icon, caption }: typeof sections[number]) { return <button key={label}><Icon /><span>{label}{caption && <small>{caption}</small>}</span><ChevronRight /></button> }
function formatDate(value: string) { const [year, month, day] = value.split('-'); return year && month && day ? `${day}.${month}.${year}` : value }
