import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { createId } from './id'

export type PriceItem = { id: string; name: string; unit: string; cost: number; price: number }
export type PriceCategory = { id: string; name: string }
export type PriceTemplate = { id: string; name: string }
export type PriceList = { id: string; name: string; categories: PriceCategory[]; templates: PriceTemplate[]; items: PriceItem[] }

type PricingContextValue = {
  priceLists: PriceList[]
  loading: boolean
  error: string
  addPriceList: (name: string) => string
  renamePriceList: (id: string, name: string) => void
  duplicatePriceList: (id: string) => void
  deletePriceList: (id: string) => void
  addCategory: (priceListId: string, name: string) => void
  addTemplate: (priceListId: string, name: string) => void
  renameTemplate: (priceListId: string, templateId: string, name: string) => void
  duplicateTemplate: (priceListId: string, templateId: string) => void
  deleteTemplate: (priceListId: string, templateId: string) => void
  addItem: (priceListId: string, item: Omit<PriceItem, 'id'>) => void
  updateItem: (priceListId: string, itemId: string, item: Omit<PriceItem, 'id'>) => void
  duplicateItem: (priceListId: string, itemId: string) => void
  deleteItem: (priceListId: string, itemId: string) => void
  importItems: (priceListId: string, items: Omit<PriceItem, 'id'>[]) => void
}

const PricingContext = createContext<PricingContextValue | null>(null)

export function PricingProvider({ children }: { children: ReactNode }) {
  const {user}=useAuth()
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [loading,setLoading]=useState(Boolean(user));const [error,setError]=useState('')
  useEffect(()=>{let active=true;if(!user){setPriceLists([]);setLoading(false);return}setLoading(true);setError('');api<PriceList[]>('/price-lists').then(server=>{if(active)setPriceLists(server)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Не удалось загрузить прайс-листы')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[user?.id,user?.role])
  function update(transform: (current: PriceList[]) => PriceList[]) {
    setPriceLists((current) => {
      const next = transform(current)
      const before=new Map(current.map(item=>[item.id,item]));const after=new Map(next.map(item=>[item.id,item]));for(const item of next){const method=before.has(item.id)?'PUT':'POST';const path=method==='POST'?'/price-lists':`/price-lists/${encodeURIComponent(item.id)}`;void api(path,{method,body:JSON.stringify(item)}).catch(cause=>setError(cause instanceof Error?cause.message:'Не удалось сохранить прайс-лист'))}for(const item of current)if(!after.has(item.id))void api(`/price-lists/${encodeURIComponent(item.id)}`,{method:'DELETE'}).catch(cause=>setError(cause instanceof Error?cause.message:'Не удалось удалить прайс-лист'))
      return next
    })
  }

  const value = useMemo<PricingContextValue>(() => ({
    priceLists,loading,error,
    addPriceList(name) {
      const id = createId()
      update((current) => [...current, { id, name, categories: [], templates: [], items: [] }])
      return id
    },
    renamePriceList(id, name) { update((current) => current.map((list) => list.id === id ? { ...list, name } : list)) },
    duplicatePriceList(id) { update((current) => { const source = current.find((list) => list.id === id); return source ? [...current, { ...structuredClone(source), id: createId(), name: `${source.name} — копия` }] : current }) },
    deletePriceList(id) { update((current) => current.filter((list) => list.id !== id)) },
    addCategory(priceListId, name) { update((current) => current.map((list) => list.id === priceListId ? { ...list, categories: [...list.categories, { id: createId(), name }] } : list)) },
    addTemplate(priceListId, name) { update((current) => current.map((list) => list.id === priceListId ? { ...list, templates: [...list.templates, { id: createId(), name }] } : list)) },
    renameTemplate(priceListId, templateId, name) { update((current) => current.map((list) => list.id === priceListId ? { ...list, templates: list.templates.map((template) => template.id === templateId ? { ...template, name } : template) } : list)) },
    duplicateTemplate(priceListId, templateId) { update((current) => current.map((list) => { const template = list.templates.find((candidate) => candidate.id === templateId); return list.id === priceListId && template ? { ...list, templates: [...list.templates, { ...template, id: createId(), name: `${template.name} — копия` }] } : list })) },
    deleteTemplate(priceListId, templateId) { update((current) => current.map((list) => list.id === priceListId ? { ...list, templates: list.templates.filter((template) => template.id !== templateId) } : list)) },
    addItem(priceListId, item) { update((current) => current.map((list) => list.id === priceListId ? { ...list, items: [...list.items, { ...item, id: createId() }] } : list)) },
    updateItem(priceListId, itemId, item) { update((current) => current.map((list) => list.id === priceListId ? { ...list, items: list.items.map((currentItem) => currentItem.id === itemId ? { ...item, id: itemId } : currentItem) } : list)) },
    duplicateItem(priceListId, itemId) { update((current) => current.map((list) => { const item = list.items.find((candidate) => candidate.id === itemId); return list.id === priceListId && item ? { ...list, items: [...list.items, { ...item, id: createId(), name: `${item.name} — копия` }] } : list })) },
    deleteItem(priceListId, itemId) { update((current) => current.map((list) => list.id === priceListId ? { ...list, items: list.items.filter((item) => item.id !== itemId) } : list)) },
    importItems(priceListId, items) { update((current) => current.map((list) => list.id === priceListId ? { ...list, items: [...list.items, ...items.map((item) => ({ ...item, id: createId() }))] } : list)) },
  }), [priceLists,loading,error])

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>
}

export function usePricing() {
  const value = useContext(PricingContext)
  if (!value) throw new Error('usePricing must be used inside PricingProvider')
  return value
}
