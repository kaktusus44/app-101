import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function PageHeader({ title, actions, onBack }: { title: string; actions?: React.ReactNode; onBack?: () => void }) {
  const navigate = useNavigate()
  return (
    <header className="page-header">
      <button className="icon-button" type="button" onClick={onBack ?? (() => navigate(-1))} aria-label="Назад">
        <ArrowLeft size={27} />
      </button>
      <h1>{title}</h1>
      <div className="page-header__actions">{actions}</div>
    </header>
  )
}
