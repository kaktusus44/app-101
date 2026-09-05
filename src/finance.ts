import { useEffect, useState } from 'react'
import { api } from './api'

export type FinanceEvent = {
  id: string
  counterpartyId: string
  type: 'receipt' | 'report' | 'transfer' | 'estimate'
  amount: number
  status: 'pending' | 'confirmed' | 'rejected'
  projectId: string
  eventDate: string
  receiptDestination: 'project' | 'agent_fee' | 'company_fund' | ''
  transferKind: 'project_payment' | 'project_accountable' | 'fund_payment' | 'project_to_fund' | 'fund_to_project' | ''
  positions?: FinancePosition[]
}

export type FinancePosition = { sourceItemId: string; name: string; unit: string; quantity: number; cost: number; price: number; expenseArticleId: string }

export type FinancialSummary = { balance: number; income: number; expense: number }

export function useFinanceEvents() {
  const [events, setEvents] = useState<FinanceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api<{ events: FinanceEvent[] }>('/finance-events')
      .then((data) => { if (active) setEvents(data.events) })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить финансы') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return { events, loading, error }
}

export function summarizeProject(events: FinanceEvent[], projectId: string): FinancialSummary {
  return events.filter((event) => event.projectId === projectId).reduce<FinancialSummary>((result, event) => {
    if (event.status !== 'confirmed' || event.type === 'estimate') return result
    const incoming = event.type === 'receipt' || (event.type === 'transfer' && event.transferKind === 'fund_to_project')
    if (incoming) result.income += event.amount
    else result.expense += event.amount
    result.balance = result.income - result.expense
    return result
  }, { balance: 0, income: 0, expense: 0 })
}

export function summarize(events: FinanceEvent[]): FinancialSummary {
  return events.reduce<FinancialSummary>((result, event) => {
    if (event.status !== 'confirmed' || event.type === 'estimate') return result
    if (event.type === 'receipt') result.income += event.amount
    else result.expense += event.amount
    result.balance = result.income - result.expense
    return result
  }, { balance: 0, income: 0, expense: 0 })
}

export function isFundEvent(event: FinanceEvent) {
  if (event.type === 'receipt') return event.receiptDestination === 'company_fund'
  if (event.type === 'report' || event.type === 'estimate') return !event.projectId
  return ['fund_payment', 'project_to_fund', 'fund_to_project'].includes(event.transferKind)
}

export function summarizeFund(events: FinanceEvent[]): FinancialSummary {
  return events.filter(isFundEvent).reduce<FinancialSummary>((result, event) => {
    if (event.status !== 'confirmed' || event.type === 'estimate') return result
    const incoming = event.type === 'receipt' || (event.type === 'transfer' && event.transferKind === 'project_to_fund')
    if (incoming) result.income += event.amount
    else result.expense += event.amount
    result.balance = result.income - result.expense
    return result
  }, { balance: 0, income: 0, expense: 0 })
}

export function money(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)
}
