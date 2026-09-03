import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useProjects } from '../projects'

export function NewProject() {
  const navigate = useNavigate()
  const { addProject } = useProjects()
  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const [customer, setCustomer] = useState('')
  const [completionDate, setCompletionDate] = useState('')
  const [area, setArea] = useState('')
  const [address, setAddress] = useState('')
  const [photoAlbumUrl, setPhotoAlbumUrl] = useState('')
  function submit(event: FormEvent) { event.preventDefault(); const id = addProject({ name: name.trim(), shortName: shortName.trim(), customer: customer.trim(), completionDate, area: Number(area || 0), address: address.trim(), photoAlbumUrl: photoAlbumUrl.trim() }); navigate(`/projects/${id}`, { replace: true }) }

  return <main className="light-page"><div className="mobile-page"><PageHeader title="Новый проект" /><form className="project-form" onSubmit={submit}><h2>Информация о проекте</h2><div className="field-group"><input placeholder="Название" value={name} onChange={(event) => setName(event.target.value)} required /><input placeholder="Короткое название" value={shortName} onChange={(event) => setShortName(event.target.value)} /><input placeholder="Заказчик" value={customer} onChange={(event) => setCustomer(event.target.value)} required /><label><span>Дата завершения</span><input type="date" aria-label="Дата завершения" value={completionDate} onChange={(event) => setCompletionDate(event.target.value)} /></label><input type="number" min="0" step="0.1" placeholder="Площадь м²" value={area} onChange={(event) => setArea(event.target.value)} /></div><input className="single-field" placeholder="Адрес (напр. г. Москва, ул. Пятницкая, 25)" value={address} onChange={(event) => setAddress(event.target.value)} /><p className="field-help">Используется во всех документах. Укажите адрес, как в договоре.</p><h2>Дополнительно</h2><label className="single-field inline-field"><input type="url" placeholder="Ссылка на фотоальбом" value={photoAlbumUrl} onChange={(event) => setPhotoAlbumUrl(event.target.value)} /><button type="button">Вставить</button></label><button className="primary-button">Сохранить</button></form></div></main>
}
