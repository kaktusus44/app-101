import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { useAuth } from './auth'
export type CounterpartyCategory = 'customer' | 'partner' | 'contractor' | 'supplier' | 'employee'
export type Counterparty = { id: string; name: string; category: CounterpartyCategory; phone: string; email: string; invited: boolean; accepted?: boolean }
export type Invitation = { token: string; name: string; category: CounterpartyCategory; login: string; password?: string; organizationName: string; createdAt?: string; expiresAt?: string }
type Input = { name: string; category: CounterpartyCategory; login: string; password: string; organizationName: string }
type Value = { counterparties: Counterparty[]; createCounterparty: (input: Pick<Counterparty, 'name' | 'category' | 'phone' | 'email'>) => Promise<Counterparty>; createInvitation: (input: Input) => Promise<Invitation>; findInvitation: (token: string) => Promise<Invitation> }
const Context = createContext<Value | null>(null)
export function CounterpartiesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth(); const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  useEffect(() => { if (user) api<Counterparty[]>('/counterparties').then(setCounterparties).catch(() => setCounterparties([])); else setCounterparties([]) }, [user])
  const value = useMemo<Value>(() => ({ counterparties,
    async createCounterparty(input) { const counterparty = await api<Counterparty>('/counterparties', { method: 'POST', body: JSON.stringify(input) }); setCounterparties((current) => [counterparty, ...current]); return counterparty },
    async createInvitation(input) { const invitation = await api<Invitation>('/invitations', { method: 'POST', body: JSON.stringify({ name: input.name, email: input.login, password: input.password, category: input.category }) }); setCounterparties((current) => [{ id: invitation.token, name: invitation.name, category: invitation.category, phone: '', email: invitation.login, invited: true }, ...current]); return { ...invitation, password: input.password } },
    findInvitation(token) { return api<Invitation>(`/invitations/${encodeURIComponent(token)}`) },
  }), [counterparties])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useCounterparties() { const value = useContext(Context); if (!value) throw new Error('useCounterparties must be used inside CounterpartiesProvider'); return value }
export const categoryLabels: Record<CounterpartyCategory, string> = { customer: 'Заказчик', partner: 'Партнёр', contractor: 'Подрядчик', supplier: 'Поставщик', employee: 'Сотрудник' }
