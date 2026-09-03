import { Search } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { usePricing } from '../pricing'

const units = [
  'шт.', 'м²', 'м. пог.', 'м³', 'кг', 'день', 'час', 'чел./смена',
  'чел./час', 'выход', 'рейс', 'мех./смена', 'мех./час.', 'услуга',
  'компл.', 'ед.', 'точка', 'счёт', 'мешок', 'т', 'км', 'литр', 'мес.',
  '%', 'м.пог. / шт', 'м² или м. пог.', 'комплекс', 'группа', 'модуль',
  'см', 'мм', 'г', 'сотка', 'см²', 'мм²', 'дм³', 'попугаи',
]

export function NewPriceItem() {
  const { priceListId = '', itemId } = useParams()
  const navigate = useNavigate()
  const { priceLists, addItem, updateItem } = usePricing()
  const list = priceLists.find((candidate) => candidate.id === priceListId)
  const existingItem = list?.items.find((item) => item.id === itemId)
  const [name, setName] = useState(existingItem?.name ?? '')
  const [unit, setUnit] = useState(existingItem?.unit ?? 'шт.')
  const [cost, setCost] = useState(existingItem ? String(existingItem.cost) : '')
  const [price, setPrice] = useState(existingItem ? String(existingItem.price) : '')
  const [unitOpen, setUnitOpen] = useState(false)
  const [query, setQuery] = useState('')
  const filteredUnits = useMemo(() => units.filter((candidate) => candidate.toLowerCase().includes(query.toLowerCase())), [query])
  if (!list) return <Navigate to="/price-lists" replace />
  const numericCost = Number(cost || 0)
  const numericPrice = Number(price || 0)
  const profit = numericPrice - numericCost
  const margin = numericPrice === 0 ? null : profit / numericPrice * 100
  function submit(event: FormEvent) { event.preventDefault(); const item = { name: name.trim(), unit, cost: numericCost, price: numericPrice }; if (itemId) updateItem(priceListId, itemId, item); else addItem(priceListId, item); navigate(`/price-lists/${priceListId}`, { replace: true }) }
  return <main className="light-page"><div className="mobile-page"><PageHeader title="Новая позиция" /><form className="item-editor" onSubmit={submit}><input className="single-field" placeholder="Название" value={name} onChange={(event) => setName(event.target.value)} required /><div className="field-group compact-fields"><button type="button" onClick={() => setUnitOpen(true)}><span>Ед. изм.</span><strong>{unit}</strong></button><label><span>Себестоимость</span><input type="number" min="0" step="0.01" placeholder="0" value={cost} onChange={(event) => setCost(event.target.value)} /></label><label><span>Цена</span><input type="number" min="0" step="0.01" placeholder="0" value={price} onChange={(event) => setPrice(event.target.value)} /></label></div><div className="calculation-preview"><span>Прибыль <b className={profit < 0 ? 'negative' : ''}>{profit}</b></span><span>Маржинальность <b className={margin !== null && margin < 0 ? 'negative' : ''}>{margin === null ? '—' : `${margin.toFixed(0)}%`}</b></span></div><button className="primary-button">Сохранить</button></form>{unitOpen && <div className="sheet-backdrop"><section className="unit-sheet"><div className="sheet-heading"><button onClick={() => setUnitOpen(false)}>Отменить</button><h2>Единица измерения</h2><span /></div><label className="search-field"><Search /><input placeholder="Поиск" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="unit-list">{filteredUnits.map((candidate) => <button key={candidate} onClick={() => { setUnit(candidate); setUnitOpen(false); setQuery('') }}>{candidate}</button>)}</div></section></div>}</div></main>
}
