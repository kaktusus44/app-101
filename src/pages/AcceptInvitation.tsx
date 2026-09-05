import { KeyRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import {
  categoryLabels,
  useCounterparties,
  type Invitation,
} from "../counterparties";
import { BrandLogo } from "../components/BrandLogo";

export function AcceptInvitation() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user, acceptInvitation } = useAuth();
  const { findInvitation } = useCounterparties();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    findInvitation(token)
      .then(setInvitation)
      .catch((reason) =>
        setError(
          reason instanceof Error ? reason.message : "Приглашение недоступно",
        ),
      )
      .finally(() => setLoading(false));
  }, [token]);
  if (user) return <Navigate to="/" replace />;
  if (loading)
    return (
      <main className="login-page">
        <section className="login-card">
          <p>Проверяем приглашение…</p>
        </section>
      </main>
    );
  if (!invitation)
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>Приглашение недоступно</h1>
          <p className="login-card__lead">{error}</p>
          <button className="primary-button" onClick={() => navigate("/login")}>
            Перейти ко входу
          </button>
        </section>
      </main>
    );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!invitation) return;
    setPending(true);
    setError("");
    try {
      await acceptInvitation(token, invitation.login, password);
      navigate("/", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-card invitation-accept">
        <BrandLogo />
        <p className="eyebrow">Приглашение в организацию</p>
        <h1>{invitation.organizationName}</h1>
        <p className="login-card__lead">
          Вы приглашены как «{categoryLabels[invitation.category]}» с ролью
          клиента и доступом только на просмотр.
        </p>
        <div className="invite-credentials">
          <KeyRound />
          <div>
            <span>Логин</span>
            <strong>{invitation.login}</strong>
          </div>
        </div>
        <form onSubmit={submit}>
          <label>
            Временный пароль
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={pending}>
            {pending ? "Входим…" : "Войти в приложение"}
          </button>
        </form>
      </section>
    </main>
  );
}
