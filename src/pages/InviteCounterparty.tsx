import { Copy, Link, RefreshCw, Send, Share2, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { categoryLabels, useCounterparties, type CounterpartyCategory, type Invitation } from '../counterparties'
import { PageHeader } from '../components/PageHeader'

const descriptions: Record<CounterpartyCategory, string> = {
  customer: 'Заказчик проекта.',
  partner: 'Партнёр по бизнесу, прораб, помощник, руководитель проекта или бухгалтер.',
  contractor: 'Мастер, разнорабочий, субподрядчик и другие.',
  supplier: 'Магазин стройматериалов, мебели и другие.',
  employee: 'Дизайнер, менеджер, маркетолог и другие.',
}

export function InviteCounterparty() {
  const { user } = useAuth()
  const { createInvitation } = useCounterparties()
  const [category, setCategory] = useState<CounterpartyCategory | null>(null)
  const [name, setName] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState(generatePassword)
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [copied, setCopied] = useState(false)
  const inviteUrl = invitation ? `${window.location.origin}/invite/${invitation.token}` : ''
  const shareText = invitation ? `Вас пригласили в ${invitation.organizationName}.\n\nОткрыть приложение:\n${inviteUrl}\n\nЛогин: ${invitation.login}\nВременный пароль: ${invitation.password}` : ''

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!category) return
    try { setInvitation(await createInvitation({ name: name.trim(), category, login: login.trim(), password, organizationName: user?.organizationName ?? '' })) }
    catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Не удалось создать приглашение') }
  }
  async function copyInvitation() {
    if (!invitation) return
    await navigator.clipboard.writeText(shareText)
    setCopied(true)
  }
  async function shareInvitation() {
    if (!invitation) return
    if (navigator.share) {
      try { await navigator.share({ title: `Приглашение в ${invitation.organizationName}`, text: shareText }) }
      catch (reason) { if (reason instanceof DOMException && reason.name === 'AbortError') return }
    } else await copyInvitation()
  }
  function shareToTelegram() {
    if (!invitation) return
    const text = `Вас пригласили в ${invitation.organizationName}.\n\nЛогин: ${invitation.login}\nВременный пароль: ${invitation.password}`
    window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  return <main className="light-page"><div className="mobile-page invite-page">
    <PageHeader title={invitation ? 'Приглашение готово' : category ? 'Добавить контрагента' : 'Выберите категорию'} />
    {!category ? <section className="category-list">
      <div className="invite-person"><UserPlus /><span>{user?.name}</span></div>
      {(Object.keys(categoryLabels) as CounterpartyCategory[]).map((value) => <button key={value} onClick={() => setCategory(value)}><strong>{categoryLabels[value]}</strong><span>{descriptions[value]}</span></button>)}
    </section> : !invitation ? <form className="invite-form" onSubmit={submit}>
      <div className="selected-category"><span>Категория</span><strong>{categoryLabels[category]}</strong><button type="button" onClick={() => setCategory(null)}>Изменить</button></div>
      <label>Имя<input value={name} onChange={(event) => setName(event.target.value)} required placeholder="ФИО или никнейм" /></label>
      <label>Логин<input type="email" value={login} onChange={(event) => setLogin(event.target.value)} required placeholder="email@example.ru" /></label>
      <label>Временный пароль<span className="password-generator"><input value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /><button type="button" onClick={() => setPassword(generatePassword())} aria-label="Создать другой пароль"><RefreshCw /></button></span></label>
      <p className="security-note">Пароль показывается только в этом приглашении. Передайте его человеку безопасным способом.</p>
      <button className="primary-button">Создать приглашение</button>
    </form> : <section className="invitation-result">
      <div className="invitation-icon"><Link /></div><h2>{invitation.name}</h2><p>{categoryLabels[invitation.category]} · роль «Клиент, просмотр»</p>
      <dl><div><dt>Ссылка</dt><dd>{inviteUrl}</dd></div><div><dt>Логин</dt><dd>{invitation.login}</dd></div><div><dt>Временный пароль</dt><dd>{invitation.password}</dd></div></dl>
      <div className="invitation-share-actions">
        <button className="primary-button" onClick={shareInvitation}><Share2 />Поделиться</button>
        <button className="telegram-share" onClick={shareToTelegram}><Send />Отправить в Telegram</button>
        <button className="copy-invitation" onClick={copyInvitation}><Copy />{copied ? 'Скопировано' : 'Скопировать'}</button>
      </div>
      {window.location.hostname === 'localhost' && <p className="local-invite-warning">Ссылка доступна только на этом компьютере. Для внешних приглашений потребуется публичный домен.</p>}
    </section>}
  </div></main>
}

function generatePassword() { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; return Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('') }
