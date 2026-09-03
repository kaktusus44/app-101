import { useState, type FormEvent } from 'react'
import { Building2, Eye, EyeOff } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, type UserRole } from '../auth'

export function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('demo@app101.ru')
  const [password, setPassword] = useState('demo')
  const [role, setRole] = useState<UserRole>('organization')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (loading) return null
  if (user) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await signIn(email, password)
      const from = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(from, { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось войти')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark"><Building2 size={34} /></div>
        <p className="eyebrow">Управление компанией</p>
        <h1>Добро пожаловать в 101</h1>
        <p className="login-card__lead">Проекты, финансы и команда — в одном рабочем пространстве.</p>
        <form onSubmit={submit}>
          <fieldset className="role-picker">
            <legend>Войти как</legend>
            <div>
              <button type="button" className={role === 'organization' ? 'is-active' : ''} onClick={() => { setRole('organization'); setEmail('demo@app101.ru') }}>Организация</button>
              <button type="button" className={role === 'client' ? 'is-active' : ''} onClick={() => { setRole('client'); setEmail('client@app101.ru') }}>Клиент</button>
            </div>
          </fieldset>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          <label>Пароль<span className="password-input"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></span></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={pending}>{pending ? 'Входим…' : 'Войти'}</button>
        </form>
        <p className="demo-hint">Роль определяется сервером по учётной записи</p>
      </section>
    </main>
  )
}
