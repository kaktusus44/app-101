import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { usePricing } from '../pricing'

export function NewPriceList() {
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const { addPriceList } = usePricing()
  function submit(event: FormEvent) { event.preventDefault(); const id = addPriceList(name.trim()); navigate(`/price-lists/${id}`, { replace: true }) }
  return <main className="light-page"><div className="mobile-page"><PageHeader title="Новый прайс-лист" /><form className="simple-editor" onSubmit={submit}><label>Название<input autoFocus value={name} onChange={(event) => setName(event.target.value)} required /></label><button className="primary-button">Сохранить</button></form></div></main>
}
