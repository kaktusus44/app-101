import { Building2, LogOut, Mail, Pencil, UserRound, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { PageHeader } from '../components/PageHeader'

export function Profile() {
  const navigate = useNavigate()
  const { user, signOut, updateProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [organizationName, setOrganizationName] = useState(user?.organizationName ?? '')
  const [saved, setSaved] = useState(false)
  const initials = user?.name.slice(0, 2).toUpperCase() || 'П'
  const isOrganization = user?.role === 'organization'

  async function handleSignOut() { await signOut(); navigate('/login', { replace: true }) }
  function cancelEditing() { setName(user?.name ?? ''); setEmail(user?.email ?? ''); setOrganizationName(user?.organizationName ?? ''); setEditing(false) }
  async function saveProfile(event: FormEvent) { event.preventDefault(); await updateProfile({ name: name.trim(), email: email.trim(), organizationName: organizationName.trim() }); setEditing(false); setSaved(true) }

  return <main className="light-page"><div className="mobile-page profile-page">
    <PageHeader title="Профиль" actions={<button className="icon-button icon-button--blue" onClick={() => editing ? cancelEditing() : setEditing(true)} aria-label={editing ? 'Отменить редактирование' : 'Редактировать профиль'}>{editing ? <X /> : <Pencil />}</button>} />
    <section className="profile-hero"><div className="profile-avatar" aria-hidden="true">{initials}</div><div><h2>{user?.name || 'Пользователь'}</h2><p>{isOrganization ? 'Учётная запись организации' : 'Профиль клиента'}</p></div></section>
    {editing ? <form className="profile-edit-form" onSubmit={saveProfile}><label><Building2 /><span>Название организации</span><input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required /></label><label><UserRound /><span>Имя</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label><label><Mail /><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><button className="primary-button">Сохранить изменения</button></form> : <section className="profile-details" aria-label="Данные профиля"><div className="profile-row"><Building2 size={22} /><div><span>Организация</span><strong>{user?.organizationName}</strong></div></div><div className="profile-row"><UserRound size={22} /><div><span>Имя</span><strong>{user?.name || 'Не указано'}</strong></div></div><div className="profile-row"><Mail size={22} /><div><span>Email</span><strong>{user?.email}</strong></div></div></section>}
    {saved && !editing && <p className="success-message profile-success" role="status">Изменения сохранены</p>}
    <div className={`role-summary role-summary--${user?.role}`}><strong>{isOrganization ? 'Организация · редактор' : 'Клиент · просмотр'}</strong><span>{isOrganization ? 'Можно создавать и изменять данные' : 'Изменение разделов пока недоступно'}</span></div>
    <button className="logout-button" onClick={handleSignOut}><LogOut size={22} />Выйти из аккаунта</button>
  </div></main>
}
