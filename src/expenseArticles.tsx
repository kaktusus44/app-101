import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { createId } from './id'

export type ProfitShare = { counterpartyId: string; name: string; percent: number }
export type ExpenseArticle = { id: string; projectId: string; name: string; allowPositions: boolean; markupEnabled: boolean; markupPercent: number; markupShares: ProfitShare[]; costDifferenceEnabled: boolean; costDifferenceShares: ProfitShare[] }
type ArticleInput = Omit<ExpenseArticle, 'id'>
type Value = { articles: ExpenseArticle[]; addArticle: (value: ArticleInput) => string; updateArticle: (id: string, value: ArticleInput) => void; deleteArticle: (id: string) => void; duplicateToProject: (id: string, projectId: string) => void }
const STORAGE_KEY = 'app101.expense-articles'
const Context = createContext<Value | null>(null)
function read() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ExpenseArticle[] } catch { return [] } }

export function ExpenseArticlesProvider({ children }: { children: ReactNode }) {
  const [articles, setArticles] = useState<ExpenseArticle[]>(read)
  function change(transform: (items: ExpenseArticle[]) => ExpenseArticle[]) { setArticles((items) => { const next = transform(items); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return next }) }
  const value = useMemo<Value>(() => ({
    articles,
    addArticle(input) { const id = createId(); change((items) => [...items, { ...input, id }]); return id },
    updateArticle(id, input) { change((items) => items.map((item) => item.id === id ? { ...input, id } : item)) },
    deleteArticle(id) { change((items) => items.filter((item) => item.id !== id)) },
    duplicateToProject(id, projectId) { change((items) => { const source = items.find((item) => item.id === id); return source ? [...items, { ...structuredClone(source), id: createId(), projectId, name: `${source.name} — копия` }] : items }) },
  }), [articles])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useExpenseArticles() { const value = useContext(Context); if (!value) throw new Error('ExpenseArticlesProvider is missing'); return value }
