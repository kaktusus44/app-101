import { CreditCard, HelpCircle, Search, SlidersHorizontal, UserPlus, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { categoryLabels, useCounterparties } from '../counterparties'
import { PageHeader } from '../components/PageHeader'

export function Counterparties() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { counterparties } = useCounterparties()
  const [query, setQuery] = useState('')
  const canEdit = user?.role === 'organization'
  const filtered = useMemo(() => counterparties.filter((person) => person.name.toLowerCase().includes(query.toLowerCase())), [counterparties, query])
  const grouped = Object.entries(filtered.reduce<Record<string, typeof filtered>>((result, person) => { (result[person.category] ??= []).push(person); return result }, {}))
  return <main className="light-page"><div className="mobile-page counterparties-page"><PageHeader title="Контрагенты" actions={<button className="icon-button icon-button--blue" aria-label="Справка"><HelpCircle /></button>} /><label className="search-field counterparty-search"><Search /><input placeholder="Поиск" value={query} onChange={(event) => setQuery(event.target.value)} /><SlidersHorizontal /></label><section className="my-data"><p>Мои данные</p><article><div className="person-heading"><div className="person-avatar"><UserRound /></div><div><strong>{user?.name}</strong><span>{user?.role === 'organization' ? 'Основатель компании' : 'Клиент'}</span></div></div><div className="balance-row"><CreditCard />Собственный баланс<strong>В расчёте</strong></div></article></section>{grouped.map(([category, people]) => <section className="counterparty-group" key={category}><p>{categoryLabels[category as keyof typeof categoryLabels]} ({people?.length ?? 0})</p>{people?.map((person) => <article className="counterparty-card" key={person.id}><strong>{person.name}</strong><span className={person.invited ? 'invited' : ''}>{person.invited ? 'Приглашён(а)' : 'Не приглашён(а)'}</span><div className="balance-row"><CreditCard />Баланс<strong>В расчёте</strong></div></article>)}</section>)}{canEdit && <button className="fab fab--page" onClick={() => navigate('/counterparties/invite')} aria-label="Пригласить человека"><UserPlus /></button>}</div></main>
}
