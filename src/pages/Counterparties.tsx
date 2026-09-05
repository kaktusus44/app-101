import { BriefcaseBusiness, Check, HelpCircle, Home, Search, SlidersHorizontal, UserPlus, UserRound, WalletCards } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { categoryLabels, useCounterparties } from '../counterparties'
import { PageHeader } from '../components/PageHeader'

type FundsBucket = 'own' | 'accountable' | 'fund'
export type BalanceSummary = Record<FundsBucket, number> & { pending: number }
type BalanceFilter = 'all' | 'awaiting_payment' | 'overspent' | 'calculating' | 'pending_events'
export type FinanceEvent = {
  type: 'receipt' | 'report' | 'transfer' | 'estimate'
  amount: number
  status: 'pending' | 'confirmed' | 'rejected'
  projectId: string
  receiptDestination: 'project' | 'agent_fee' | 'company_fund' | ''
  transferKind: 'project_payment' | 'project_accountable' | 'fund_payment' | 'project_to_fund' | 'fund_to_project' | ''
  eventDate?: string
}

export function Counterparties() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { counterparties } = useCounterparties()
  const [query, setQuery] = useState('')
  const [balances, setBalances] = useState<Record<string, BalanceSummary>>({})
  const [balanceFilter,setBalanceFilter]=useState<BalanceFilter>('all')
  const [draftFilter,setDraftFilter]=useState<BalanceFilter>('all')
  const [filterOpen,setFilterOpen]=useState(false)
  const canEdit = user?.role === 'organization'
  const ownerIds = useMemo(() => [user?.id, ...counterparties.map((person) => person.id)].filter((id): id is string => Boolean(id)), [user?.id, counterparties])
  const ownerIdsKey = ownerIds.join('|')

  useEffect(() => {
    let active = true
    Promise.allSettled(ownerIds.map(async (id) => {
      const data = await api<{ events: FinanceEvent[] }>(`/counterparties/${id}/finance-events`)
      return [id, summarizeBalances(data.events)] as const
    })).then((results) => {
      if (!active) return
      setBalances(Object.fromEntries(results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])))
    })
    return () => { active = false }
  }, [ownerIdsKey])

  const categoryFilter = searchParams.get('category')
  const filtered = useMemo(() => counterparties.filter((person) => (!categoryFilter || person.category === categoryFilter) && person.name.toLowerCase().includes(query.toLowerCase()) && matchesBalanceFilter(balances[person.id],balanceFilter)), [counterparties, query, categoryFilter,balances,balanceFilter])
  const grouped = Object.entries(filtered.reduce<Record<string, typeof filtered>>((result, person) => { (result[person.category] ??= []).push(person); return result }, {}))
  const myBalances = user ? balances[user.id] : undefined

  return <main className="light-page"><div className="mobile-page counterparties-page">
    <PageHeader title="Контрагенты" actions={<button className="icon-button icon-button--blue" aria-label="Справка"><HelpCircle /></button>} />
    <div className="counterparty-search-row"><label className="search-field counterparty-search"><Search /><input placeholder="Поиск" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className={balanceFilter==='all'?'':'is-active'} onClick={()=>{setDraftFilter(balanceFilter);setFilterOpen(true)}} aria-label="Фильтр по балансу"><SlidersHorizontal /></button></div>
    <section className="my-data"><p>Мои данные</p><article className={canEdit ? 'my-data-card' : ''} onClick={canEdit ? () => navigate('/counterparties/me') : undefined}>
      <div className="person-heading"><div className="person-avatar"><UserRound /></div><div><strong>{user?.name}</strong><span>{canEdit ? 'Основатель компании' : 'Клиент'}</span></div></div>
      <BalanceRow icon={<WalletCards />} label="Собственный баланс" value={myBalances?.own} />
      <BalanceRow icon={<Home />} label="Подотчётный баланс по проектам" value={myBalances?.accountable} />
      {canEdit && <BalanceRow icon={<BriefcaseBusiness />} label="Подотчётный баланс в Фонде компании" value={myBalances?.fund} />}
    </article></section>
    {grouped.map(([category, people]) => <section className="counterparty-group" key={category}><p>{categoryLabels[category as keyof typeof categoryLabels]} ({people?.length ?? 0})</p>{people?.map((person) => <article className="counterparty-card" key={person.id} onClick={() => navigate(`/counterparties/${person.id}`)}>
      <strong>{person.name}</strong><span className={person.invited ? 'invited' : ''}>{person.invited ? 'Приглашён(а)' : 'Не приглашён(а)'}</span>
      <BalanceRow icon={<WalletCards />} label="Собственный баланс" value={balances[person.id]?.own} />
      <BalanceRow icon={<Home />} label="Подотчётный баланс по проектам" value={balances[person.id]?.accountable} />
    </article>)}</section>)}
    {canEdit && <button className="fab fab--page" onClick={() => navigate('/counterparties/invite')} aria-label="Пригласить человека"><UserPlus /></button>}
    {filterOpen&&<div className="sheet-backdrop" onClick={()=>setFilterOpen(false)}><section className="counterparty-balance-filter" onClick={event=>event.stopPropagation()}><header><button onClick={()=>setDraftFilter('all')}>Очистить</button><h2>Баланс</h2><button onClick={()=>{setBalanceFilter(draftFilter);setFilterOpen(false)}}>Готово</button></header>{([['awaiting_payment','Ожидает оплаты'],['overspent','Перерасходован'],['calculating','В расчёте'],['pending_events','Имеют неподтверждённые события']] as [BalanceFilter,string][]).map(([value,label])=><button className={draftFilter===value?'is-active':''} onClick={()=>setDraftFilter(value)} key={value}><span>{label}</span><i>{draftFilter===value&&<Check/>}</i></button>)}</section></div>}
  </div></main>
}

function BalanceRow({ icon, label, value }: { icon: ReactNode; label: string; value?: number }) {
  return <div className="balance-row">{icon}<span>{label}</span><strong className={value !== undefined && value < 0 ? 'is-negative' : ''}>{value === undefined ? 'В расчёте' : money(value)}</strong></div>
}

export function summarizeBalances(events: FinanceEvent[]): BalanceSummary {
  return events.reduce<BalanceSummary>((summary, event) => {
    if (event.status !== 'confirmed' || event.type === 'estimate') return summary
    const bucket = eventBucket(event)
    summary[bucket] += event.type === 'receipt' ? event.amount : -event.amount
    return summary
  }, { own: 0, accountable: 0, fund: 0, pending: events.filter(event=>event.status==='pending').length })
}

function matchesBalanceFilter(summary:BalanceSummary|undefined,filter:BalanceFilter){if(filter==='all')return true;if(filter==='calculating')return !summary;if(!summary)return false;if(filter==='pending_events')return summary.pending>0;const total=summary.own+summary.accountable+summary.fund;return filter==='awaiting_payment'?total>0:total<0}

function eventBucket(event: FinanceEvent): FundsBucket {
  if (event.type === 'receipt') {
    if (event.receiptDestination === 'agent_fee') return 'own'
    return event.receiptDestination === 'company_fund' ? 'fund' : 'accountable'
  }
  if (event.type === 'transfer' && ['fund_payment', 'project_to_fund', 'fund_to_project'].includes(event.transferKind)) return 'fund'
  if (event.type === 'report' && !event.projectId) return 'fund'
  return event.projectId ? 'accountable' : 'own'
}

function money(value: number) { return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value) }
