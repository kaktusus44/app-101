import {
  Check,
  ChevronRight,
  FileText,
  Home,
  ImageUp,
  Link,
  ListChecks,
  Pencil,
  Plus,
  QrCode,
  Search,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import jsQR from "jsqr";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { categoryLabels, useCounterparties } from "../counterparties";
import { PageHeader } from "../components/PageHeader";
import { useProjects } from "../projects";
import { usePricing } from "../pricing";

type FinanceType = "receipt" | "report" | "transfer" | "estimate";
type ReceiptDestination = "project" | "agent_fee" | "company_fund";
type EstimateDestination = "project" | "company_fund";
type FundsFilter = "own" | "accountable" | "fund_accountable";
type TransferKind =
  | "project_payment"
  | "project_accountable"
  | "fund_payment"
  | "project_to_fund"
  | "fund_to_project";
type TransferMovement = {
  label: string;
  owner?: string;
  before: number;
  change: number;
  tone: "project" | "accountable" | "own" | "fund";
};
type TransferResult = {
  id: string;
  kind: TransferKind;
  recipient: string;
  project: string;
  amount: number;
  phase: "pending" | "confirmed";
  movements: TransferMovement[];
};
type FinanceEvent = {
  id: string;
  type: FinanceType;
  amount: number;
  secondaryAmount?: number;
  estimateDestination?: EstimateDestination | "";
  expenseCategory?: string;
  estimatePositions?: string;
  status: "pending" | "confirmed" | "rejected";
  projectId: string;
  projectName: string;
  description: string;
  eventDate: string;
  attachmentUrl: string;
  receiptDestination: ReceiptDestination | "";
  tag: string;
  relatedPartyId: string;
  relatedPartyName: string;
  transferKind: TransferKind | "";
  createdAt: string;
  createdBy: string;
};
type FinanceData = {
  events: FinanceEvent[];
  balance: number;
  received: number;
  spent: number;
};
const typeLabels: Record<FinanceType, string> = {
  receipt: "Поступление",
  report: "Отчёт",
  transfer: "Перевод",
  estimate: "Смета",
};
const statusLabels = {
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждено",
  rejected: "Отклонено",
};
const destinationLabels: Record<ReceiptDestination, string> = {
  project: "По проекту",
  agent_fee: "Агент. возн.",
  company_fund: "В Фонд компании",
};
const transferLabels: Record<TransferKind, string> = {
  project_payment: "Оплата или аванс по проекту",
  project_accountable: "Перевод подотчётных средств по проекту",
  fund_payment: "Оплата или аванс из Фонда компании",
  project_to_fund: "Перевод из проекта в Фонд компании",
  fund_to_project: "Перевод из Фонда компании в проект",
};

export function CounterpartyDetails() {
  const { counterpartyId = "", eventType = "", eventId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = location.state as { returnTo?: string; projectId?: string } | null;
  const returnTo =
    navigationState?.returnTo ??
    `/counterparties/${counterpartyId}`;
  const { user } = useAuth();
  const { counterparties, createCounterparty } = useCounterparties();
  const { projects } = useProjects();
  const { priceLists } = usePricing();
  const [query, setQuery] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [formType, setFormType] = useState<FinanceType | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<FinanceEvent | null>(null);
  const [editingEventId, setEditingEventId] = useState("");
  const [fundsFilter, setFundsFilter] = useState<FundsFilter>("own");
  const [transferKind, setTransferKind] =
    useState<TransferKind>("project_payment");
  const [estimateDestination, setEstimateDestination] =
    useState<EstimateDestination>("project");
  const [secondaryAmount, setSecondaryAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [estimatePositionIds, setEstimatePositionIds] = useState<string[]>([]);
  const [positionsOpen, setPositionsOpen] = useState(false);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(
    null,
  );
  const [amount, setAmount] = useState("");
  const [projectId, setProjectId] = useState(navigationState?.projectId ?? "");
  const [receiptDestination, setReceiptDestination] =
    useState<ReceiptDestination>("project");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [data, setData] = useState<FinanceData>({
    events: [],
    balance: 0,
    received: 0,
    spent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [relatedPartyId, setRelatedPartyId] = useState("");
  const [creatingRelatedParty, setCreatingRelatedParty] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyPhone, setNewPartyPhone] = useState("");
  const [newPartyEmail, setNewPartyEmail] = useState("");
  const [savingParty, setSavingParty] = useState(false);
  const [fiscalQr, setFiscalQr] = useState("");
  const [qrError, setQrError] = useState("");
  const [qrReading, setQrReading] = useState(false);
  const eventReturnTo =
    returnTo === "/events"
      ? sessionStorage.getItem("app101.eventHistoryReturnTo") || returnTo
      : returnTo;
  const isSelf = counterpartyId === "me" || counterpartyId === user?.id;
  const canEdit = user?.role === "organization";
  const financeOwnerId = isSelf ? (user?.id ?? "") : counterpartyId;
  const person =
    isSelf && user && canEdit
      ? {
          id: user.id,
          name: user.name,
          category: "partner" as const,
          phone: "",
          email: user.email,
          invited: true,
        }
      : counterparties.find((item) => item.id === counterpartyId);
  async function load() {
    if (!financeOwnerId) return;
    setLoading(true);
    try {
      setData(
        await api<FinanceData>(
          `/counterparties/${financeOwnerId}/finance-events`,
        ),
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (person && financeOwnerId) void load();
  }, [financeOwnerId, person?.id]);
  useEffect(() => {
    if (
      eventType &&
      ["receipt", "report", "transfer", "estimate"].includes(eventType)
    )
      setFormType(eventType as FinanceType);
  }, [eventType]);
  useEffect(() => {
    if (formType === "estimate" && !editingEventId)
      navigate(`/counterparties/${counterpartyId}/events/new/estimate`, {
        state: { returnTo: eventReturnTo, projectId },
      });
  }, [formType, editingEventId, counterpartyId, navigate, eventReturnTo]);
  useEffect(() => {
    if (!formType) setEditingEventId("");
  }, [formType]);
  useEffect(() => {
    if (eventId && data.events.length)
      setSelectedEvent(
        data.events.find((event) => event.id === eventId) ?? null,
      );
  }, [eventId, data.events]);
  const events = useMemo(
    () =>
      data.events.filter(
        (event) =>
          eventFundsFilter(event) === fundsFilter &&
          `${typeLabels[event.type]} ${event.receiptDestination ? destinationLabels[event.receiptDestination] : ""} ${event.relatedPartyName} ${event.tag} ${event.description} ${event.projectName}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [data.events, fundsFilter, query],
  );
  const summaries = useMemo(
    () => ({
      own: financeSummary(
        data.events.filter((event) => eventFundsFilter(event) === "own"),
      ),
      accountable: financeSummary(
        data.events.filter(
          (event) => eventFundsFilter(event) === "accountable",
        ),
      ),
      fund_accountable: financeSummary(
        data.events.filter(
          (event) => eventFundsFilter(event) === "fund_accountable",
        ),
      ),
    }),
    [data.events],
  );
  const summary = summaries[fundsFilter];
  if (!person) return <Navigate to="/counterparties" replace />;
  async function createEvent(event: FormEvent) {
    event.preventDefault();
    if (!formType) return;
    const project = projects.find((item) => item.id === projectId);
    const relatedParty = counterparties.find(
      (item) => item.id === relatedPartyId,
    );
    const hasProject =
      formType === "estimate"
        ? estimateDestination === "project"
        : formType !== "receipt" || receiptDestination === "project";
    let recipientOwnBefore = 0;
    let recipientAccountableBefore = 0;
    if (formType === "transfer" && relatedPartyId) {
      try {
        const recipientData =
          relatedPartyId === financeOwnerId
            ? data
            : await api<FinanceData>(
                `/counterparties/${relatedPartyId}/finance-events`,
              );
        recipientOwnBefore = financeSummary(
          recipientData.events.filter(
            (item) => eventFundsFilter(item) === "own",
          ),
        ).balance;
        recipientAccountableBefore = financeSummary(
          recipientData.events.filter(
            (item) => eventFundsFilter(item) === "accountable",
          ),
        ).balance;
      } catch {
        /* Новый получатель начинает с нулевого баланса. */
      }
    }
    const selectedPositions = priceLists
      .flatMap((list) => list.items)
      .filter((item) => estimatePositionIds.includes(item.id))
      .map((item) => item.name)
      .join(", ");
    const body = JSON.stringify({
      type: formType,
      amount: Number(amount || 0),
      secondaryAmount:
        formType === "estimate" ? Number(secondaryAmount || 0) : 0,
      estimateDestination: formType === "estimate" ? estimateDestination : "",
      expenseCategory: formType === "estimate" ? expenseCategory : "",
      estimatePositions: formType === "estimate" ? selectedPositions : "",
      projectId: hasProject ? projectId : "",
      projectName: hasProject ? (project?.name ?? "") : "",
      receiptDestination: formType === "receipt" ? receiptDestination : "",
      relatedPartyId,
      relatedPartyName:
        relatedParty?.name ?? (relatedPartyId === user?.id ? user.name : ""),
      transferKind: formType === "transfer" ? transferKind : "",
      tag,
      description,
      eventDate,
      attachmentUrl,
    });
    const created = await api<{ id: string }>(
      editingEventId
        ? `/finance-events/${editingEventId}`
        : `/counterparties/${financeOwnerId}/finance-events`,
      { method: editingEventId ? "PATCH" : "POST", body },
    );
    if (formType === "transfer" && !editingEventId)
      setTransferResult({
        id: created.id,
        kind: transferKind,
        recipient:
          relatedParty?.name ?? (relatedPartyId === user?.id ? user.name : ""),
        project: project?.name ?? "",
        amount: Number(amount || 0),
        phase: "pending",
        movements: buildTransferMovements(
          transferKind,
          Number(amount || 0),
          project?.balance ?? 0,
          summaries.accountable.balance,
          recipientOwnBefore,
          recipientAccountableBefore,
          relatedParty?.name ?? (relatedPartyId === user?.id ? user.name : ""),
        ),
      });
    setFormType(null);
    setEditingEventId("");
    setAmount("");
    setSecondaryAmount("");
    setProjectId("");
    setRelatedPartyId("");
    setReceiptDestination("project");
    setEstimateDestination("project");
    setExpenseCategory("");
    setEstimatePositionIds([]);
    setTransferKind("project_payment");
    setTag("");
    setDescription("");
    setAttachmentUrl("");
    setFiscalQr("");
    setQrError("");
    await load();
    if ((eventType || eventId) && formType !== "transfer")
      navigate(eventReturnTo, { replace: true });
  }
  async function saveRelatedParty() {
    if (!newPartyName.trim()) return;
    setSavingParty(true);
    try {
      const created = await createCounterparty({
        name: newPartyName.trim(),
        category: "customer",
        phone: newPartyPhone.trim(),
        email: newPartyEmail.trim(),
      });
      setRelatedPartyId(created.id);
      setCreatingRelatedParty(false);
      setNewPartyName("");
      setNewPartyPhone("");
      setNewPartyEmail("");
    } finally {
      setSavingParty(false);
    }
  }
  async function review(id: string, status: "confirmed" | "rejected") {
    await api(`/finance-events/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
  }
  function editEvent(event: FinanceEvent) {
    setEditingEventId(event.id);
    setFormType(event.type);
    setAmount(String(event.amount));
    setProjectId(event.projectId);
    setReceiptDestination(event.receiptDestination || "project");
    setTransferKind(event.transferKind || "project_payment");
    setRelatedPartyId(event.relatedPartyId);
    setTag(event.tag);
    setDescription(event.description);
    setEventDate(event.eventDate);
    setAttachmentUrl(event.attachmentUrl);
    setSelectedEvent(null);
  }
  function closeEventDetails() {
    setSelectedEvent(null);
    if (eventId) navigate(eventReturnTo, { replace: true });
  }
  async function deleteEvent(event: FinanceEvent) {
    if (!window.confirm("Удалить это событие? Восстановить его будет нельзя."))
      return;
    await api(`/finance-events/${event.id}`, { method: "DELETE" });
    closeEventDetails();
    await load();
  }
  function closeFinanceForm() {
    setFormType(null);
    setEditingEventId("");
    if (eventType || eventId) navigate(eventReturnTo, { replace: true });
  }
  async function confirmTransfer() {
    if (!transferResult) return;
    await review(transferResult.id, "confirmed");
    setTransferResult({ ...transferResult, phase: "confirmed" });
  }
  function finishTransfer() {
    setTransferResult(null);
    if (eventType) navigate(eventReturnTo, { replace: true });
  }
  function applyFiscalQr(value: string) {
    setFiscalQr(value);
    const parsed = parseFiscalQr(value);
    if (!parsed) {
      setQrError("В QR-коде не найден корректный параметр суммы s");
      return;
    }
    setAmount(String(parsed.amount));
    setQrError("");
    if (parsed.date) setEventDate(parsed.date);
  }
  async function readQrImage(file?: File) {
    if (!file) return;
    setQrReading(true);
    setQrError("");
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error();
      context.drawImage(bitmap, 0, 0);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(image.data, image.width, image.height);
      if (!result) throw new Error();
      applyFiscalQr(result.data);
    } catch {
      setQrError(
        "Не удалось распознать QR-код. Попробуйте другое фото или вставьте строку вручную.",
      );
    } finally {
      setQrReading(false);
    }
  }
  return (
    <main className="light-page">
      <div className="mobile-page counterparty-details-page">
        <PageHeader title="" />
        <section className="counterparty-profile-card">
          <div className="person-avatar">
            <UserRound />
          </div>
          <div>
            <h1>{person.name}</h1>
            <strong>
              {isSelf ? "Основатель компании" : categoryLabels[person.category]}
            </strong>
            <span>
              {isSelf
                ? "Мои данные"
                : person.invited
                  ? "Есть доступ к приложению"
                  : "Без доступа к приложению"}
            </span>
          </div>
          <ChevronRight />
        </section>
        <section className="counterparty-links">
          <button>
            <Home />
            Баланс по проектам и Фонду компании
            <ChevronRight />
          </button>
          <button
            onClick={() =>
              navigate(`/counterparties/${counterpartyId}/reconciliation`)
            }
          >
            <FileText />
            Акт сверки
            <ChevronRight />
          </button>
        </section>
        <label className="search-field">
          <Search />
          <input
            placeholder="Поиск"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <p className="counterparty-balance-label">
          {fundsFilter === "own"
            ? "Собственные средства по проектам и Фонду компании"
            : fundsFilter === "accountable"
              ? "Подотчётные средства по проектам"
              : "Подотчётные средства по Фонду компании"}
        </p>
        <div className="counterparty-balance-badges">
          <button
            className={fundsFilter === "own" ? "is-active" : ""}
            onClick={() => setFundsFilter("own")}
            aria-label="Собственные средства"
          >
            <WalletCards />
            {money(summaries.own.balance)}
          </button>
          <button
            className={fundsFilter === "accountable" ? "is-active" : ""}
            onClick={() => setFundsFilter("accountable")}
            aria-label="Подотчётные средства по проектам"
          >
            <Home />
            {money(summaries.accountable.balance)}
          </button>
          {isSelf && (
            <button
              className={fundsFilter === "fund_accountable" ? "is-active" : ""}
              onClick={() => setFundsFilter("fund_accountable")}
              aria-label="Подотчётные средства по Фонду компании"
            >
              <WalletCards />
              {money(summaries.fund_accountable.balance)}
            </button>
          )}
        </div>
        <section className="counterparty-totals">
          <p>
            Баланс <strong>{money(summary.balance)}</strong>
          </p>
          <p>
            Получено <strong>{money(summary.received)}</strong>
          </p>
          <p>
            {fundsFilter === "own" ? "Заработано" : "Потрачено"}{" "}
            <strong>
              {money(fundsFilter === "own" ? summary.earned : summary.spent)}
            </strong>
          </p>
        </section>
        <p className="counterparty-events-title">События ({events.length})</p>
        {loading ? (
          <p className="counterparty-empty-events">Загрузка…</p>
        ) : !events.length ? (
          <p className="counterparty-empty-events">
            Событий с этим контрагентом пока нет
          </p>
        ) : (
          <section className="finance-event-list">
            {events.map((event) => (
              <article
                className={`finance-event finance-event--${event.status}`}
                key={event.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedEvent(event)}
                onKeyDown={(keyEvent) => {
                  if (keyEvent.key === "Enter") setSelectedEvent(event);
                }}
              >
                <header>
                  <strong>{financeEventTitle(event)}</strong>
                  <span>{money(event.amount)} ₽</span>
                </header>
                <small>
                  {statusLabels[event.status]} · {formatDate(event.eventDate)}
                </small>
                {event.relatedPartyName && (
                  <p>
                    <UserRound />
                    {event.type === "transfer"
                      ? "Получатель"
                      : event.receiptDestination === "agent_fee"
                        ? "Плательщик"
                        : "Заказчик"}
                    : {event.relatedPartyName}
                  </p>
                )}
                {event.projectName && (
                  <p>
                    <Home />
                    {event.projectName}
                  </p>
                )}
                {event.tag && <span className="finance-tag">#{event.tag}</span>}
                {event.description && <p>{event.description}</p>}
                {event.attachmentUrl && (
                  <a
                    href={event.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(clickEvent) => clickEvent.stopPropagation()}
                  >
                    <Link />
                    Открыть вложение
                  </a>
                )}
                {event.status === "pending" && (
                  <div
                    className="finance-review"
                    onClick={(clickEvent) => clickEvent.stopPropagation()}
                  >
                    <button onClick={() => review(event.id, "confirmed")}>
                      <Check />
                      Подтвердить
                    </button>
                    <button onClick={() => review(event.id, "rejected")}>
                      <X />
                      Отклонить
                    </button>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
        {transferResult && (
          <div className="sheet-backdrop transfer-result-backdrop">
            <section className="transfer-result-card">
              {transferResult.phase === "pending" ? (
                <>
                  <div className="transfer-result-icon transfer-result-icon--pending">
                    ◷
                  </div>
                  <h2>Перевод ожидает вашего подтверждения</h2>
                  <p>
                    После подтверждения операция будет учтена в соответствующих
                    балансах.
                  </p>
                  <article>
                    <strong>{transferLabels[transferResult.kind]}</strong>
                    {transferResult.project && (
                      <span>
                        <Home />
                        {transferResult.project}
                      </span>
                    )}
                    <span>
                      <UserRound />
                      Получатель: {transferResult.recipient}
                    </span>
                    <b>{money(transferResult.amount)} ₽</b>
                  </article>
                  <button
                    className="transfer-confirm-button"
                    onClick={confirmTransfer}
                  >
                    Подтвердить
                  </button>
                  <button
                    className="transfer-skip-button"
                    onClick={finishTransfer}
                  >
                    Пропустить
                  </button>
                </>
              ) : (
                <>
                  <div className="transfer-result-icon transfer-result-icon--success">
                    <Check />
                  </div>
                  <h2>Перевод подтверждён</h2>
                  <p>Движение средств по операции</p>
                  <div className="transfer-movements">
                    {transferResult.movements.map((movement, index) => (
                      <article
                        className={`transfer-movement transfer-movement--${movement.tone}`}
                        key={`${movement.label}-${index}`}
                      >
                        <strong>{movement.label}</strong>
                        {movement.owner && <span>{movement.owner}</span>}
                        <b
                          className={
                            movement.change < 0
                              ? "is-negative"
                              : movement.change > 0
                                ? "is-positive"
                                : ""
                          }
                        >
                          {movement.change > 0 ? "+" : ""}
                          {money(movement.change)} ₽
                        </b>
                        <div>
                          <s>{money(movement.before)}</s>
                          <em>→</em>
                          <strong>
                            {money(movement.before + movement.change)}
                          </strong>
                        </div>
                      </article>
                    ))}
                  </div>
                  <button className="primary-button" onClick={finishTransfer}>
                    Готово
                  </button>
                </>
              )}
            </section>
          </div>
        )}
        {selectedEvent && (
          <div
            className="sheet-backdrop finance-details-backdrop"
            onClick={closeEventDetails}
          >
            <section
              className={`finance-event-details finance-event-details--${selectedEvent.status}`}
              onClick={(clickEvent) => clickEvent.stopPropagation()}
            >
              <div className="customer-picker__header">
                <button type="button" onClick={closeEventDetails}>
                  <X />
                </button>
                <h2>{financeEventTitle(selectedEvent)}</h2>
                <span />
              </div>
              {canEdit && (
                <div className="finance-details-actions">
                  <button onClick={() => editEvent(selectedEvent)}>
                    <Pencil />
                    Редактировать
                  </button>
                  <button onClick={() => deleteEvent(selectedEvent)}>
                    <Trash2 />
                    Удалить
                  </button>
                </div>
              )}
              <div className="finance-details-status">
                <Check />
                <strong>{statusLabels[selectedEvent.status]}</strong>
              </div>
              <dl>
                <div>
                  <dt>Дата события</dt>
                  <dd>{formatDate(selectedEvent.eventDate)}</dd>
                </div>
                <div>
                  <dt>Добавил(а)</dt>
                  <dd>{selectedEvent.createdBy}</dd>
                </div>
                <div>
                  <dt>Создано</dt>
                  <dd>{formatDateTime(selectedEvent.createdAt)}</dd>
                </div>
                {selectedEvent.relatedPartyName && (
                  <div>
                    <dt>
                      {selectedEvent.receiptDestination === "agent_fee"
                        ? "Плательщик"
                        : "Заказчик"}
                    </dt>
                    <dd>{selectedEvent.relatedPartyName}</dd>
                  </div>
                )}
                {selectedEvent.projectName && (
                  <div>
                    <dt>Проект</dt>
                    <dd>{selectedEvent.projectName}</dd>
                  </div>
                )}
                {selectedEvent.description && (
                  <div>
                    <dt>Описание</dt>
                    <dd>{selectedEvent.description}</dd>
                  </div>
                )}
                {selectedEvent.tag && (
                  <div>
                    <dt>Тег</dt>
                    <dd>#{selectedEvent.tag}</dd>
                  </div>
                )}
              </dl>
              {selectedEvent.attachmentUrl && (
                <div className="finance-details-media">
                  {isImageUrl(selectedEvent.attachmentUrl) && (
                    <a
                      href={selectedEvent.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={selectedEvent.attachmentUrl}
                        alt="Вложение к событию"
                      />
                    </a>
                  )}
                  <a
                    className="finance-details-attachment"
                    href={selectedEvent.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Link />
                    Открыть вложение
                  </a>
                </div>
              )}
              <div className="finance-details-amount">
                <span>Сумма</span>
                <strong>{money(selectedEvent.amount)} ₽</strong>
              </div>
              {selectedEvent.status === "pending" && (
                <div className="finance-review">
                  <button
                    onClick={async () => {
                      await review(selectedEvent.id, "confirmed");
                      setSelectedEvent(null);
                    }}
                  >
                    <Check />
                    Подтвердить
                  </button>
                  <button
                    onClick={async () => {
                      await review(selectedEvent.id, "rejected");
                      setSelectedEvent(null);
                    }}
                  >
                    <X />
                    Отклонить
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
        {canEdit && (
          <button
            className="fab fab--page"
            onClick={() => setActionsOpen(true)}
            aria-label="Добавить событие"
          >
            <Plus />
          </button>
        )}
        {actionsOpen && (
          <div className="sheet-backdrop">
            <section className="counterparty-event-sheet">
              <div className="sheet-heading">
                <span />
                <h2>Добавить событие</h2>
                <button
                  className="icon-button"
                  onClick={() => setActionsOpen(false)}
                >
                  <X />
                </button>
              </div>
              {(Object.keys(typeLabels) as FinanceType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setFormType(type);
                    setActionsOpen(false);
                  }}
                >
                  <Plus />
                  {typeLabels[type]}
                </button>
              ))}
            </section>
          </div>
        )}
        {formType && (
          <div className="sheet-backdrop">
            <form className="finance-event-form" onSubmit={createEvent}>
              <div className="customer-picker__header">
                <button type="button" onClick={closeFinanceForm}>
                  <X />
                </button>
                <h2>{typeLabels[formType]}</h2>
                <span />
              </div>
              {formType === "receipt" && (
                <div className="receipt-destination-tabs">
                  {(Object.keys(destinationLabels) as ReceiptDestination[]).map(
                    (destination) => (
                      <button
                        type="button"
                        className={
                          receiptDestination === destination ? "is-active" : ""
                        }
                        onClick={() => {
                          setReceiptDestination(destination);
                          setRelatedPartyId("");
                          setCreatingRelatedParty(false);
                          if (destination !== "project") setProjectId("");
                        }}
                        key={destination}
                      >
                        {destinationLabels[destination]}
                      </button>
                    ),
                  )}
                </div>
              )}
              {formType === "transfer" && (
                <section className="transfer-fields">
                  <label>
                    Кому
                    <select
                      value={relatedPartyId}
                      onChange={(event) => {
                        if (event.target.value === "__new")
                          setCreatingRelatedParty(true);
                        else {
                          setRelatedPartyId(event.target.value);
                          setCreatingRelatedParty(false);
                        }
                      }}
                      required
                    >
                      <option value="">Выберите получателя</option>
                      {user && <option value={user.id}>(Я) {user.name}</option>}
                      {counterparties.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                      <option value="__new">
                        ＋ Добавить нового получателя
                      </option>
                    </select>
                  </label>
                  {creatingRelatedParty && (
                    <section className="inline-party-form">
                      <strong>Новый получатель</strong>
                      <input
                        placeholder="Имя или компания"
                        value={newPartyName}
                        onChange={(event) =>
                          setNewPartyName(event.target.value)
                        }
                        autoFocus
                      />
                      <input
                        type="tel"
                        placeholder="Телефон"
                        value={newPartyPhone}
                        onChange={(event) =>
                          setNewPartyPhone(event.target.value)
                        }
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={newPartyEmail}
                        onChange={(event) =>
                          setNewPartyEmail(event.target.value)
                        }
                      />
                      <button
                        type="button"
                        onClick={saveRelatedParty}
                        disabled={savingParty || !newPartyName.trim()}
                      >
                        {savingParty
                          ? "Создаём…"
                          : "Создать и выбрать получателя"}
                      </button>
                    </section>
                  )}
                  <div className="transfer-kind-list">
                    {(Object.keys(transferLabels) as TransferKind[]).map(
                      (kind) => (
                        <button
                          type="button"
                          className={`transfer-kind transfer-kind--${kind} ${transferKind === kind ? "is-active" : ""}`}
                          onClick={() => setTransferKind(kind)}
                          key={kind}
                        >
                          <span className="transfer-flow">
                            <i />
                            <b>→</b>
                            <i />
                          </span>
                          {transferLabels[kind]}
                        </button>
                      ),
                    )}
                  </div>
                  <label>
                    Проект
                    <select
                      value={projectId}
                      onChange={(event) => setProjectId(event.target.value)}
                      required
                    >
                      <option value="">Выберите проект</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>
              )}
              {formType === "receipt" &&
                (receiptDestination === "project" ||
                  receiptDestination === "agent_fee") && (
                  <div
                    className={`related-party-field related-party-field--${receiptDestination}`}
                  >
                    <label>
                      {receiptDestination === "project"
                        ? "Заказчик"
                        : "Плательщик"}
                      <select
                        value={relatedPartyId}
                        onChange={(event) => {
                          if (event.target.value === "__new")
                            setCreatingRelatedParty(true);
                          else {
                            setRelatedPartyId(event.target.value);
                            setCreatingRelatedParty(false);
                          }
                        }}
                        required
                      >
                        <option value="">
                          {receiptDestination === "project"
                            ? "Выберите заказчика"
                            : "Выберите плательщика"}
                        </option>
                        {counterparties
                          .filter(
                            (item) =>
                              receiptDestination !== "project" ||
                              item.category === "customer",
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        <option value="__new">
                          {receiptDestination === "project"
                            ? "＋ Добавить нового заказчика"
                            : "＋ Добавить нового плательщика"}
                        </option>
                      </select>
                    </label>
                    {creatingRelatedParty && (
                      <section className="inline-party-form">
                        <strong>
                          {receiptDestination === "project"
                            ? "Новый заказчик"
                            : "Новый плательщик"}
                        </strong>
                        <input
                          placeholder={
                            receiptDestination === "project"
                              ? "Имя или компания заказчика"
                              : "Имя или компания плательщика"
                          }
                          value={newPartyName}
                          onChange={(event) =>
                            setNewPartyName(event.target.value)
                          }
                          autoFocus
                        />
                        <input
                          type="tel"
                          placeholder="Телефон"
                          value={newPartyPhone}
                          onChange={(event) =>
                            setNewPartyPhone(event.target.value)
                          }
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={newPartyEmail}
                          onChange={(event) =>
                            setNewPartyEmail(event.target.value)
                          }
                        />
                        <button
                          type="button"
                          onClick={saveRelatedParty}
                          disabled={savingParty || !newPartyName.trim()}
                        >
                          {savingParty
                            ? "Создаём…"
                            : receiptDestination === "project"
                              ? "Создать и выбрать заказчика"
                              : "Создать и выбрать плательщика"}
                        </button>
                      </section>
                    )}
                  </div>
                )}
              {formType === "report" && (
                <section className="fiscal-qr">
                  <header>
                    <QrCode />
                    <span>
                      <strong>QR-код кассового чека</strong>
                      <small>Сумма и дата заполнятся автоматически</small>
                    </span>
                  </header>
                  <label className="fiscal-qr-upload">
                    <ImageUp />
                    {qrReading ? "Распознаём…" : "Сфотографировать или выбрать QR"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) => void readQrImage(event.target.files?.[0])}
                    />
                  </label>
                  <textarea
                    value={fiscalQr}
                    onChange={(event) => setFiscalQr(event.target.value)}
                    placeholder="Или вставьте строку: t=…&s=220.00&fn=…"
                  />
                  <button type="button" onClick={() => applyFiscalQr(fiscalQr)} disabled={!fiscalQr.trim()}>
                    Извлечь сумму
                  </button>
                  {qrError && <p className="form-error">{qrError}</p>}
                  {fiscalQr && !qrError && amount && (
                    <p className="fiscal-qr-success"><Check />Сумма {money(Number(amount))} ₽ получена из чека</p>
                  )}
                </section>
              )}
              <label>
                Сумма
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </label>
              {formType !== "transfer" &&
                (formType !== "receipt" ||
                  receiptDestination === "project") && (
                  <label>
                    Проект
                    <select
                      value={projectId}
                      onChange={(event) => setProjectId(event.target.value)}
                      required={formType === "receipt"}
                    >
                      <option value="">
                        {formType === "receipt"
                          ? "Выберите проект"
                          : "Без проекта"}
                      </option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              <label>
                Дата
                <input
                  type="date"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                  required
                />
              </label>
              <label>
                Описание
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label>
                Тег
                <input
                  value={tag}
                  onChange={(event) =>
                    setTag(event.target.value.replace(/^#/, ""))
                  }
                  placeholder="Например, аванс"
                />
              </label>
              <label>
                Ссылка на вложение
                <input
                  type="url"
                  value={attachmentUrl}
                  onChange={(event) => setAttachmentUrl(event.target.value)}
                  placeholder="https://…"
                />
              </label>
              <button className="primary-button">Создать событие</button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
    value,
  );
}
function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}
function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
function isImageUrl(value: string) {
  try {
    return /\.(avif|gif|jpe?g|png|webp)$/i.test(new URL(value).pathname);
  } catch {
    return false;
  }
}
function parseFiscalQr(value: string) {
  const source = value.trim().replace(/^[^?]*\?/, "");
  const params = new URLSearchParams(source);
  const amount = Number((params.get("s") ?? "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const rawDate = params.get("t") ?? "";
  const match = rawDate.match(/^(\d{4})(\d{2})(\d{2})/);
  return { amount, date: match ? `${match[1]}-${match[2]}-${match[3]}` : "" };
}
function financeEventTitle(event: FinanceEvent) {
  if (event.type === "receipt" && event.receiptDestination)
    return `Поступление: ${destinationLabels[event.receiptDestination]}`;
  if (event.type === "transfer" && event.transferKind)
    return transferLabels[event.transferKind];
  return typeLabels[event.type];
}
function eventFundsFilter(event: FinanceEvent): FundsFilter {
  if (event.type === "receipt") {
    if (event.receiptDestination === "agent_fee") return "own";
    return event.receiptDestination === "company_fund"
      ? "fund_accountable"
      : "accountable";
  }
  if (
    event.type === "transfer" &&
    ["fund_payment", "project_to_fund", "fund_to_project"].includes(
      event.transferKind,
    )
  )
    return "fund_accountable";
  if (event.type === "estimate" && event.estimateDestination === "company_fund")
    return "fund_accountable";
  if (event.type === "report" && !event.projectId) return "fund_accountable";
  return event.projectId ? "accountable" : "own";
}
function financeSummary(events: FinanceEvent[]) {
  return events.reduce(
    (result, event) => {
      if (event.status !== "confirmed") return result;
      if (event.type === "receipt") {
        if (event.receiptDestination === "agent_fee")
          result.earned += event.amount;
        else result.received += event.amount;
        result.balance += event.amount;
      } else if (event.type === "report" || event.type === "transfer") {
        result.spent += event.amount;
        result.balance -= event.amount;
      }
      return result;
    },
    { balance: 0, received: 0, earned: 0, spent: 0 },
  );
}
function buildTransferMovements(
  kind: TransferKind,
  amount: number,
  projectBefore: number,
  senderAccountableBefore: number,
  recipientOwnBefore: number,
  recipientAccountableBefore: number,
  recipient: string,
): TransferMovement[] {
  switch (kind) {
    case "project_payment":
      return [
        {
          label: "Баланс проекта",
          before: projectBefore,
          change: 0,
          tone: "project",
        },
        {
          label: "Подотчётный баланс отправителя",
          before: senderAccountableBefore,
          change: -amount,
          tone: "accountable",
        },
        {
          label: "Собственный баланс получателя",
          owner: recipient,
          before: recipientOwnBefore,
          change: amount,
          tone: "own",
        },
      ];
    case "project_accountable":
      return [
        {
          label: "Подотчётный баланс отправителя",
          before: senderAccountableBefore,
          change: -amount,
          tone: "accountable",
        },
        {
          label: "Подотчётный баланс получателя",
          owner: recipient,
          before: recipientAccountableBefore,
          change: amount,
          tone: "accountable",
        },
      ];
    case "fund_payment":
      return [
        {
          label: "Фонд компании",
          before: senderAccountableBefore,
          change: -amount,
          tone: "fund",
        },
        {
          label: "Собственный баланс получателя",
          owner: recipient,
          before: recipientOwnBefore,
          change: amount,
          tone: "own",
        },
      ];
    case "project_to_fund":
      return [
        {
          label: "Баланс проекта",
          before: projectBefore,
          change: -amount,
          tone: "project",
        },
        {
          label: "Фонд компании",
          before: senderAccountableBefore,
          change: amount,
          tone: "fund",
        },
      ];
    case "fund_to_project":
      return [
        {
          label: "Фонд компании",
          before: senderAccountableBefore,
          change: -amount,
          tone: "fund",
        },
        {
          label: "Баланс проекта",
          before: projectBefore,
          change: amount,
          tone: "project",
        },
      ];
  }
}
