import { useState } from 'react'
import { BarChart3, BriefcaseBusiness, Building2, ChevronRight, CircleMinus, CirclePlus, CircleUserRound, Landmark, List, Plus, QrCode, Settings, Table2, Users, X, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

type CardProps = { icon: LucideIcon; title: string; children?: React.ReactNode; onClick?: () => void; value?: string }

function DashboardCard({ icon: Icon, title, children, onClick, value }: CardProps) {
  return <button className="dashboard-card" onClick={onClick} disabled={!onClick}><span className="dashboard-card__title"><Icon size={25} /><strong>{title}</strong></span>{value && <span className="dashboard-card__value">{value}</span>}{onClick && <ChevronRight className="dashboard-card__chevron" size={23} />}{children}</button>
}

const events = [
  { label: 'Поступление', icon: CirclePlus },
  { label: 'Отчёт', icon: CircleMinus, qr: true },
  { label: 'Перевод', icon: CircleUserRound },
  { label: 'Смета', icon: CircleMinus },
]

export function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canEdit = user?.role === 'organization'
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div><div className="company-name"><BriefcaseBusiness size={24} /> {user?.organizationName} <ChevronRight size={20} /></div><div className={`role-badge role-badge--${user?.role}`}>{canEdit ? 'Организация · редактор' : 'Клиент · просмотр'}</div><p>ОБНОВЛЕНО ТОЛЬКО ЧТО</p></div>
          <button className="icon-button icon-button--dark" onClick={() => navigate('/profile')} aria-label="Профиль и настройки"><Settings size={27} /></button>
        </header>
        <section className="dashboard-cards">
          <DashboardCard icon={Building2} title="Проекты" value="0" onClick={() => navigate('/projects')}><span className="metric">0</span><span className="muted">прибыли по всем проектам за <b>4 недели</b></span></DashboardCard>
          <DashboardCard icon={Users} title="Контрагенты" onClick={() => navigate('/counterparties')}><span className="metric">0</span><span className="muted">мой подотчётный баланс по проектам и фонду компании</span><span className="metric">0</span><span className="muted">мой доход за <b>4 недели</b></span></DashboardCard>
          <DashboardCard icon={List} title="История событий" value="0" onClick={() => undefined} />
          <DashboardCard icon={Table2} title="Прайс-листы" onClick={() => navigate('/price-lists')} />
          <DashboardCard icon={Landmark} title="Фонд компании" onClick={() => undefined}><span className="metric">0</span><span className="muted">баланс Фонда компании</span></DashboardCard>
          <DashboardCard icon={BarChart3} title="Аналитика" onClick={() => undefined} />
        </section>
        {canEdit && <button className="fab" onClick={() => setMenuOpen(true)} aria-label="Добавить событие"><Plus size={38} /></button>}
      </div>
      {menuOpen && <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}><section className="event-sheet" onClick={(event) => event.stopPropagation()} aria-modal="true" role="dialog"><div className="sheet-heading"><h2>Добавить событие</h2><button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Закрыть"><X /></button></div>{events.map(({ label, icon: Icon, qr }) => <div className="event-row" key={label}><button className="event-action"><Icon size={23} />{label}</button>{qr && <button className="qr-button" aria-label="Сканировать QR-код"><QrCode /></button>}</div>)}</section></div>}
    </main>
  )
}
