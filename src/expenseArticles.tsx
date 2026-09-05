import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { useProjects } from './projects'
import { createId } from './id'

export type ProfitShare = { counterpartyId: string; name: string; percent: number }
export type ExpenseArticle = { id: string; projectId: string; name: string; allowPositions: boolean; markupEnabled: boolean; markupPercent: number; markupShares: ProfitShare[]; costDifferenceEnabled: boolean; costDifferenceShares: ProfitShare[] }
type ArticleInput = Omit<ExpenseArticle, 'id'>
type Value = { articles: ExpenseArticle[]; loading:boolean; error:string; addArticle: (value: ArticleInput) => string; updateArticle: (id: string, value: ArticleInput) => void; deleteArticle: (id: string) => void; duplicateToProject: (id: string, projectId: string) => void }
const Context = createContext<Value | null>(null)

export function ExpenseArticlesProvider({ children }: { children: ReactNode }) {
  const {user}=useAuth();const {loading:projectsLoading}=useProjects();const [articles, setArticles] = useState<ExpenseArticle[]>([]);const [loading,setLoading]=useState(Boolean(user));const [error,setError]=useState('')
  useEffect(()=>{let active=true;if(!user){setArticles([]);setLoading(false);return}if(projectsLoading)return;setLoading(true);setError('');api<ExpenseArticle[]>('/expense-articles').then(server=>{if(active)setArticles(server)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Не удалось загрузить статьи расходов')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[user?.id,user?.role,projectsLoading])
  function change(transform: (items: ExpenseArticle[]) => ExpenseArticle[]) { setArticles((items) => { const next=transform(items);const before=new Map(items.map(item=>[item.id,item]));const after=new Map(next.map(item=>[item.id,item]));for(const item of next){const method=before.has(item.id)?'PUT':'POST';const path=method==='POST'?'/expense-articles':`/expense-articles/${encodeURIComponent(item.id)}`;void api(path,{method,body:JSON.stringify(item)}).catch(cause=>setError(cause instanceof Error?cause.message:'Не удалось сохранить статью расходов'))}for(const item of items)if(!after.has(item.id))void api(`/expense-articles/${encodeURIComponent(item.id)}`,{method:'DELETE'}).catch(cause=>setError(cause instanceof Error?cause.message:'Не удалось удалить статью расходов'));return next }) }
  const value = useMemo<Value>(() => ({
    articles,loading,error,
    addArticle(input) { const id = createId(); change((items) => [...items, { ...input, id }]); return id },
    updateArticle(id, input) { change((items) => items.map((item) => item.id === id ? { ...input, id } : item)) },
    deleteArticle(id) { change((items) => items.filter((item) => item.id !== id)) },
    duplicateToProject(id, projectId) { change((items) => { const source = items.find((item) => item.id === id); return source ? [...items, { ...structuredClone(source), id: createId(), projectId, name: `${source.name} — копия` }] : items }) },
  }), [articles,loading,error])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useExpenseArticles() { const value = useContext(Context); if (!value) throw new Error('ExpenseArticlesProvider is missing'); return value }
