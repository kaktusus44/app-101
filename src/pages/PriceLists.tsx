import { Copy, Ellipsis, FileDown, Pencil, Share2, Table2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { PageHeader } from '../components/PageHeader'
import { usePricing } from '../pricing'

export function PriceLists() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { priceLists, renamePriceList, duplicatePriceList, deletePriceList } = usePricing()
  const canEdit = user?.role === 'organization'
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  function rename(id: string, current: string) {
    const name = window.prompt('Новое название прайс-листа', current)?.trim()
    if (name) renamePriceList(id, name)
    setOpenMenu(null)
  }

  return <main className="light-page"><div className="mobile-page price-lists-page"><PageHeader title="Прайс-листы" /><section className="price-intro"><Table2 size={56} /><h2>Прайс-листы</h2><p>• Прайс-лист упрощает управление ценами и снижает риск ошибок в отчётах.</p><p>• Используйте разные прайс-листы для проектов.</p><p>• Создавайте прайс-листы с подкатегориями для группировки позиций.</p></section>{notice && <p className="inline-notice" role="status">{notice}</p>}<section className="price-list-stack">{priceLists.map((list) => <article className="price-list-row" key={list.id}><button className="price-list-main" onClick={() => navigate(`/price-lists/${list.id}`)}><strong>{list.name}</strong><span>{list.categories.length} категорий, {list.templates.length} шаблонов, {list.items.length} позиций</span></button>{canEdit && <button className="dots-button" onClick={() => setOpenMenu(openMenu === list.id ? null : list.id)} aria-label={`Действия с прайс-листом ${list.name}`}><Ellipsis /></button>}{openMenu === list.id && <div className="context-menu"><button onClick={() => rename(list.id, list.name)}><Pencil />Переименовать</button><button onClick={() => { duplicatePriceList(list.id); setOpenMenu(null) }}><Copy />Дублировать</button><button onClick={() => { setNotice('Подготовка PDF будет подключена вместе с backend'); setOpenMenu(null) }}><Share2 />Отправить в PDF</button><button onClick={() => { setNotice('Экспорт XLSX будет подключён вместе с backend'); setOpenMenu(null) }}><FileDown />Экспортировать в XLSX</button><button className="danger-action" onClick={() => { if (window.confirm(`Удалить прайс-лист «${list.name}»?`)) deletePriceList(list.id); setOpenMenu(null) }}><Trash2 />Удалить</button></div>}</article>)}</section>{canEdit && <button className="primary-button sticky-action" onClick={() => navigate('/price-lists/new')}>Добавить прайс-лист</button>}</div></main>
}
