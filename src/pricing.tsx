import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type PriceItem = { id: string; name: string; unit: string; cost: number; price: number }
export type PriceCategory = { id: string; name: string }
export type PriceTemplate = { id: string; name: string }
export type PriceList = { id: string; name: string; categories: PriceCategory[]; templates: PriceTemplate[]; items: PriceItem[] }

type PricingContextValue = {
  priceLists: PriceList[]
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
}

const STORAGE_KEY = 'app101.price-lists'
const initialPriceLists: PriceList[] = [{
  id: 'test',
  name: 'Тест',
  categories: [{ id: 'category-1', name: 'Тест1' }],
  templates: [{ id: 'template-1', name: 'Тест2' }],
  items: [
    { id: 'item-1', name: 'Обоит', unit: 'шт.', cost: 3, price: 0 },
    { id: 'item-2', name: 'Плитка', unit: 'м²', cost: 1000, price: 500 },
  ],
}]

const PricingContext = createContext<PricingContextValue | null>(null)

function readPriceLists() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) as PriceList[] : initialPriceLists
  } catch {
    return initialPriceLists
  }
}

export function PricingProvider({ children }: { children: ReactNode }) {
  const [priceLists, setPriceLists] = useState<PriceList[]>(readPriceLists)
  function update(transform: (current: PriceList[]) => PriceList[]) {
    setPriceLists((current) => {
      const next = transform(current)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const value = useMemo<PricingContextValue>(() => ({
    priceLists,
    addPriceList(name) {
      const id = crypto.randomUUID()
      update((current) => [...current, { id, name, categories: [], templates: [], items: [] }])
      return id
    },
    renamePriceList(id, name) { update((current) => current.map((list) => list.id === id ? { ...list, name } : list)) },
    duplicatePriceList(id) { update((current) => { const source = current.find((list) => list.id === id); return source ? [...current, { ...structuredClone(source), id: crypto.randomUUID(), name: `${source.name} — копия` }] : current }) },
    deletePriceList(id) { update((current) => current.filter((list) => list.id !== id)) },
    addCategory(priceListId, name) { update((current) => current.map((list) => list.id === priceListId ? { ...list, categories: [...list.categories, { id: crypto.randomUUID(), name }] } : list)) },
    addTemplate(priceListId, name) { update((current) => current.map((list) => list.id === priceListId ? { ...list, templates: [...list.templates, { id: crypto.randomUUID(), name }] } : list)) },
    renameTemplate(priceListId, templateId, name) { update((current) => current.map((list) => list.id === priceListId ? { ...list, templates: list.templates.map((template) => template.id === templateId ? { ...template, name } : template) } : list)) },
    duplicateTemplate(priceListId, templateId) { update((current) => current.map((list) => { const template = list.templates.find((candidate) => candidate.id === templateId); return list.id === priceListId && template ? { ...list, templates: [...list.templates, { ...template, id: crypto.randomUUID(), name: `${template.name} — копия` }] } : list })) },
    deleteTemplate(priceListId, templateId) { update((current) => current.map((list) => list.id === priceListId ? { ...list, templates: list.templates.filter((template) => template.id !== templateId) } : list)) },
    addItem(priceListId, item) { update((current) => current.map((list) => list.id === priceListId ? { ...list, items: [...list.items, { ...item, id: crypto.randomUUID() }] } : list)) },
    updateItem(priceListId, itemId, item) { update((current) => current.map((list) => list.id === priceListId ? { ...list, items: list.items.map((currentItem) => currentItem.id === itemId ? { ...item, id: itemId } : currentItem) } : list)) },
    duplicateItem(priceListId, itemId) { update((current) => current.map((list) => { const item = list.items.find((candidate) => candidate.id === itemId); return list.id === priceListId && item ? { ...list, items: [...list.items, { ...item, id: crypto.randomUUID(), name: `${item.name} — копия` }] } : list })) },
    deleteItem(priceListId, itemId) { update((current) => current.map((list) => list.id === priceListId ? { ...list, items: list.items.filter((item) => item.id !== itemId) } : list)) },
  }), [priceLists])

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>
}

export function usePricing() {
  const value = useContext(PricingContext)
  if (!value) throw new Error('usePricing must be used inside PricingProvider')
  return value
}
