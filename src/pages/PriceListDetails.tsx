import { Box, ChevronRight, Copy, Ellipsis, FileOutput, Folder, MoveRight, Pencil, PlusCircle, Search, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { PageHeader } from '../components/PageHeader'
import { usePricing, type PriceList } from '../pricing'

type EntityMenu = { type: 'template' | 'item'; id: string } | null

export function PriceListDetails() {
  const { priceListId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { priceLists, addCategory, addTemplate, renamePriceList, renameTemplate, duplicateTemplate, deleteTemplate, duplicateItem, deleteItem } = usePricing()
  const list = priceLists.find((candidate) => candidate.id === priceListId)
  const canEdit = user?.role === 'organization'
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<'category' | 'template' | null>(null)
  const [editorName, setEditorName] = useState('')
  const [topMenuOpen, setTopMenuOpen] = useState(false)
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false)
  const [entityMenu, setEntityMenu] = useState<EntityMenu>(null)
  const [notice, setNotice] = useState('')

  if (!list) return <Navigate to="/price-lists" replace />
  const items = list.items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))

  function saveEntity(event: FormEvent) {
    event.preventDefault()
    const name = editorName.trim()
    if (!name || !editor) return
    if (editor === 'category') addCategory(priceListId, name)
    else addTemplate(priceListId, name)
    setEditor(null)
    setEditorName('')
  }

  function editListName() {
    const name = window.prompt('Название прайс-листа', list?.name)?.trim()
    if (name) renamePriceList(priceListId, name)
    setTopMenuOpen(false)
  }

  function editTemplate(templateId: string, currentName: string) {
    const name = window.prompt('Название шаблона', currentName)?.trim()
    if (name) renameTemplate(priceListId, templateId, name)
    setEntityMenu(null)
  }

  return <main className="light-page"><div className="mobile-page price-details-page">
    <PageHeader title={list.name} actions={canEdit ? <button className="icon-button icon-button--blue" onClick={() => { setTopMenuOpen((value) => !value); setPdfMenuOpen(false) }} aria-label="Действия"><Ellipsis /></button> : undefined} />
    {topMenuOpen && <div className="context-menu top-context-menu"><button onClick={() => setPdfMenuOpen((value) => !value)}><FileOutput />Отправить в PDF<ChevronRight /></button><button onClick={editListName}><Pencil />Изменить</button>{pdfMenuOpen && <div className="pdf-submenu"><span>Отправить в PDF</span><button onClick={() => exportPdf(list, 'contractor')}>Подрядчику (только себестоимость)</button><button onClick={() => exportPdf(list, 'customer')}>Заказчику (только цена)</button></div>}</div>}
    <label className="search-field"><Search size={24} /><input placeholder="Поиск" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    {notice && <p className="inline-notice" role="status">{notice}</p>}
    <PriceSection title="Категории" action={canEdit ? <button onClick={() => setEditor('category')}><PlusCircle />Категория</button> : null}>{list.categories.map((category) => <div className="entity-row" key={category.id}><Folder /><span>{category.name}</span>{canEdit && <Ellipsis />}<ChevronRight /></div>)}</PriceSection>
    <PriceSection title="Шаблоны" action={canEdit ? <button onClick={() => setEditor('template')}><PlusCircle />Шаблон</button> : null}>{list.templates.map((template) => <div className="entity-row entity-row--interactive" key={template.id}><Box /><span>{template.name}</span>{canEdit && <button className="dots-button" onClick={() => setEntityMenu(entityMenu?.id === template.id ? null : { type: 'template', id: template.id })}><Ellipsis /></button>}<ChevronRight />{entityMenu?.type === 'template' && entityMenu.id === template.id && <div className="context-menu entity-context-menu"><button onClick={() => editTemplate(template.id, template.name)}><Pencil />Изменить</button><button onClick={() => { duplicateTemplate(priceListId, template.id); setEntityMenu(null) }}><Copy />Дублировать</button><button onClick={() => { setNotice('Выбор категории для перемещения добавим вместе с вложенными категориями'); setEntityMenu(null) }}><MoveRight />Переместить</button><button className="danger-action" onClick={() => { deleteTemplate(priceListId, template.id); setEntityMenu(null) }}><Trash2 />Удалить</button></div>}</div>)}</PriceSection>
    <PriceSection title="Позиции" action={canEdit ? <button onClick={() => navigate(`/price-lists/${list.id}/items/new`)}><PlusCircle />Позиция</button> : null}>{items.map((item) => { const profit = item.price - item.cost; const margin = item.price === 0 ? null : profit / item.price * 100; return <article className="price-item" key={item.id}><div><strong>{item.name}</strong><span>Себестоимость <b>{formatNumber(item.cost)}</b></span><span>Прибыль <b className={profit < 0 ? 'negative' : ''}>{formatNumber(profit)}</b></span><span>Маржинальность <b className={margin !== null && margin < 0 ? 'negative' : ''}>{margin === null ? '—' : `${formatNumber(margin)}%`}</b></span></div><div className="price-item__price"><span>цена за <b>{item.unit}</b></span><strong>{formatNumber(item.price)}</strong>{canEdit && <button className="dots-button" onClick={() => setEntityMenu(entityMenu?.id === item.id ? null : { type: 'item', id: item.id })}><Ellipsis /></button>}</div>{entityMenu?.type === 'item' && entityMenu.id === item.id && <div className="context-menu entity-context-menu item-context-menu"><button onClick={() => navigate(`/price-lists/${priceListId}/items/${item.id}/edit`)}><Pencil />Изменить</button><button onClick={() => { duplicateItem(priceListId, item.id); setEntityMenu(null) }}><Copy />Дублировать</button><button onClick={() => { setNotice('Выбор категории для перемещения добавим вместе с вложенными категориями'); setEntityMenu(null) }}><MoveRight />Переместить</button><button className="danger-action" onClick={() => { deleteItem(priceListId, item.id); setEntityMenu(null) }}><Trash2 />Удалить</button></div>}</article> })}</PriceSection>
    {editor && <div className="sheet-backdrop"><form className="editor-sheet" onSubmit={saveEntity}><div className="sheet-heading"><button type="button" onClick={() => setEditor(null)}>Отменить</button><h2>{editor === 'category' ? 'Новая категория' : 'Новый шаблон'}</h2><button disabled={!editorName.trim()}>Сохранить</button></div><label>Название<input autoFocus value={editorName} onChange={(event) => setEditorName(event.target.value)} /></label></form></div>}
  </div></main>
}

function PriceSection({ title, action, children }: { title: string; action: React.ReactNode; children: React.ReactNode }) { return <section className="price-section"><header><span>{title}</span>{action}</header><div>{children}</div></section> }
function formatNumber(value: number) { return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value) }

function exportPdf(list: PriceList, audience: 'contractor' | 'customer') {
  const title = audience === 'contractor' ? 'Для подрядчика — себестоимость' : 'Для заказчика — цена'
  const valueLabel = audience === 'contractor' ? 'Себестоимость' : 'Цена'
  const popup = window.open('', '_blank')
  if (!popup) return
  popup.document.write(`<html><head><title>${escapeHtml(list.name)}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#202124}h1{margin-bottom:4px}p{color:#666}table{width:100%;border-collapse:collapse;margin-top:28px}th,td{text-align:left;padding:12px;border-bottom:1px solid #ddd}th:last-child,td:last-child{text-align:right}</style></head><body><h1>${escapeHtml(list.name)}</h1><p>${title}</p><table><thead><tr><th>Позиция</th><th>Ед. изм.</th><th>${valueLabel}</th></tr></thead><tbody>${list.items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.unit)}</td><td>${formatNumber(audience === 'contractor' ? item.cost : item.price)}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`)
  popup.document.close()
  popup.opener = null
}

function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (symbol) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[symbol] ?? symbol)) }
