import { CalendarDays, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useCounterparties } from "../counterparties";
import { useProjects } from "../projects";

export function NewProject() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { projects, loading, addProject, updateProject } = useProjects();
  const editedProject = projectId
    ? projects.find((item) => item.id === projectId)
    : undefined;
  const { counterparties, createCounterparty } = useCounterparties();
  const [name, setName] = useState(editedProject?.name ?? "");
  const [shortName, setShortName] = useState(editedProject?.shortName ?? "");
  const [customer, setCustomer] = useState(editedProject?.customer ?? "");
  const [customerId, setCustomerId] = useState(editedProject?.customerId ?? "");
  const [completionDate, setCompletionDate] = useState(
    editedProject?.completionDate ?? "",
  );
  const [area, setArea] = useState(
    editedProject?.area ? String(editedProject.area) : "",
  );
  const [address, setAddress] = useState(editedProject?.address ?? "");
  const [photoAlbumUrl, setPhotoAlbumUrl] = useState(
    editedProject?.photoAlbumUrl ?? "",
  );
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hydratedProject = useRef("");
  useEffect(() => {
    if (!editedProject || hydratedProject.current === editedProject.id) return;
    hydratedProject.current = editedProject.id;
    setName(editedProject.name); setShortName(editedProject.shortName); setCustomer(editedProject.customer); setCustomerId(editedProject.customerId ?? ""); setCompletionDate(editedProject.completionDate); setArea(editedProject.area ? String(editedProject.area) : ""); setAddress(editedProject.address); setPhotoAlbumUrl(editedProject.photoAlbumUrl);
  }, [editedProject]);
  const customers = useMemo(
    () =>
      counterparties.filter(
        (item) =>
          item.category === "customer" &&
          item.name.toLowerCase().includes(customerSearch.trim().toLowerCase()),
      ),
    [counterparties, customerSearch],
  );
  const completionDateInput = useRef<HTMLInputElement>(null);
  function openDatePicker() {
    const input = completionDateInput.current;
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.focus();
  }
  async function saveCustomer(event: FormEvent) {
    event.preventDefault();
    setSavingCustomer(true);
    try {
      const created = await createCounterparty({
        name: newCustomerName.trim(),
        category: "customer",
        phone: newCustomerPhone.trim(),
        email: newCustomerEmail.trim(),
      });
      setCustomer(created.name);
      setCustomerId(created.id);
      setCustomerPickerOpen(false);
      setCreatingCustomer(false);
    } finally {
      setSavingCustomer(false);
    }
  }
  async function pasteAlbumUrl() {
    try {
      setPhotoAlbumUrl((await navigator.clipboard.readText()).trim());
    } catch {
      window.alert("Вставьте ссылку вручную");
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    const input = {
      name: name.trim(),
      shortName: shortName.trim(),
      customer: customer.trim(),
      customerId,
      completionDate,
      area: Number(area || 0),
      address: address.trim(),
      photoAlbumUrl: photoAlbumUrl.trim(),
    };
    try {
      if (projectId) { await updateProject(projectId, input); navigate(`/projects/${projectId}`, { replace: true }); }
      else { const id = await addProject(input); navigate(`/projects/${id}`, { replace: true }); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить проект"); setSaving(false); }
  }

  if (projectId && loading) return <main className="light-page"><div className="mobile-page"><p className="empty-state">Загрузка проекта…</p></div></main>;
  if (projectId && !editedProject) return <Navigate to="/projects" replace />;

  return (
    <main className="light-page">
      <div className="mobile-page">
        <PageHeader title="Новый проект" />
        <form className="project-form" onSubmit={submit}>
          <h2>Информация о проекте</h2>
          <div className="field-group">
            <input
              placeholder="Название"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <input
              placeholder="Короткое название"
              value={shortName}
              onChange={(event) => setShortName(event.target.value)}
            />
            <button
              className="customer-select"
              type="button"
              onClick={() => setCustomerPickerOpen(true)}
            >
              <span>{customer || "Заказчик"}</span>
              <small>Выбрать</small>
            </button>
            <label className="date-picker-field">
              <span>Дата завершения</span>
              <span className="date-picker-control">
                <span
                  className={
                    completionDate
                      ? "date-picker-value"
                      : "date-picker-value is-empty"
                  }
                >
                  {completionDate
                    ? new Date(`${completionDate}T00:00:00`).toLocaleDateString(
                        "ru-RU",
                      )
                    : "Не выбрана"}
                </span>
                <input
                  className="date-picker-native"
                  ref={completionDateInput}
                  type="date"
                  aria-label="Дата завершения"
                  value={completionDate}
                  onChange={(event) => setCompletionDate(event.target.value)}
                />
                <button
                  type="button"
                  onClick={openDatePicker}
                  aria-label="Открыть календарь"
                >
                  <CalendarDays size={22} />
                </button>
              </span>
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="Площадь м²"
              value={area}
              onChange={(event) => setArea(event.target.value)}
            />
          </div>
          <input
            className="single-field"
            placeholder="Адрес (напр. г. Москва, ул. Пятницкая, 25)"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          <p className="field-help">
            Используется во всех документах. Укажите адрес, как в договоре.
          </p>
          <h2>Дополнительно</h2>
          <label className="single-field inline-field">
            <input
              type="url"
              placeholder="Ссылка на фотоальбом"
              value={photoAlbumUrl}
              onChange={(event) => setPhotoAlbumUrl(event.target.value)}
            />
            <button type="button">Вставить</button>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</button>
        </form>
        {customerPickerOpen && (
          <div className="sheet-backdrop">
            <section className="customer-picker">
              {creatingCustomer ? (
                <form onSubmit={saveCustomer}>
                  <div className="customer-picker__header">
                    <button
                      type="button"
                      onClick={() => setCreatingCustomer(false)}
                    >
                      <X />
                    </button>
                    <h2>Новый заказчик</h2>
                    <span />
                  </div>
                  <label>
                    Имя или компания
                    <input
                      value={newCustomerName}
                      onChange={(event) =>
                        setNewCustomerName(event.target.value)
                      }
                      required
                      autoFocus
                    />
                  </label>
                  <label>
                    Телефон
                    <input
                      type="tel"
                      value={newCustomerPhone}
                      onChange={(event) =>
                        setNewCustomerPhone(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={newCustomerEmail}
                      onChange={(event) =>
                        setNewCustomerEmail(event.target.value)
                      }
                    />
                  </label>
                  <button className="primary-button" disabled={savingCustomer}>
                    {savingCustomer ? "Создаём…" : "Создать и выбрать"}
                  </button>
                </form>
              ) : (
                <>
                  <div className="customer-picker__header">
                    <button
                      type="button"
                      onClick={() => setCustomerPickerOpen(false)}
                    >
                      <X />
                    </button>
                    <h2>Заказчик</h2>
                    <span />
                  </div>
                  <label className="search-field">
                    <Search />
                    <input
                      placeholder="Поиск заказчика"
                      value={customerSearch}
                      onChange={(event) =>
                        setCustomerSearch(event.target.value)
                      }
                      autoFocus
                    />
                  </label>
                  <button
                    className="create-customer"
                    type="button"
                    onClick={() => setCreatingCustomer(true)}
                  >
                    <Plus />
                    Создать заказчика
                  </button>
                  <div className="customer-options">
                    {customers.length ? (
                      customers.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setCustomer(item.name);
                            setCustomerId(item.id);
                            setCustomerPickerOpen(false);
                          }}
                        >
                          <strong>{item.name}</strong>
                          {item.email && <span>{item.email}</span>}
                        </button>
                      ))
                    ) : (
                      <p>Заказчики не найдены</p>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
