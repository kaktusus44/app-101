import {
  Check,
  CircleDashed,
  Download,
  Filter,
  Home,
  Search,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { PageHeader } from "../components/PageHeader";

type EventType = "receipt" | "report" | "transfer" | "estimate";
type Status = "pending" | "confirmed" | "rejected";
type HistoryEvent = {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  type: EventType;
  amount: number;
  status: Status;
  projectId: string;
  projectName: string;
  description: string;
  eventDate: string;
  receiptDestination: string;
  tag: string;
  relatedPartyName: string;
  transferKind: string;
  createdAt: string;
};
const labels: Record<string, string> = {
  receipt: "Поступление",
  report: "Отчёт",
  transfer: "Перевод",
  estimate: "Смета",
  project: "по проекту",
  agent_fee: "агентского вознаграждения",
  company_fund: "в Фонд компании",
  project_payment: "Оплата или аванс по проекту",
  project_accountable: "Перевод подотчётных средств по проекту",
  fund_payment: "Оплата или аванс из Фонда компании",
  project_to_fund: "Перевод из проекта в Фонд компании",
  fund_to_project: "Перевод из Фонда компании в проект",
};

export function EventHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";
  const requestedCounterparty = searchParams.get("counterpartyId") ?? "";
  const fundOnly = searchParams.get("scope") === "company_fund";
  const requestedType = searchParams.get("type");
  const returnTo = projectId
    ? `/events?projectId=${encodeURIComponent(projectId)}`
    : requestedCounterparty
      ? `/events?counterpartyId=${encodeURIComponent(requestedCounterparty)}`
      : fundOnly
        ? `/events?scope=company_fund${requestedType ? `&type=${requestedType}` : ""}`
        : "/events";
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | EventType>(() =>
    ["receipt", "report", "transfer", "estimate"].includes(requestedType || "")
      ? (requestedType as EventType)
      : "all",
  );
  const [status, setStatus] = useState<"all" | Status>("all");
  const [filterProject, setFilterProject] = useState("");
  const [counterparty, setCounterparty] = useState(requestedCounterparty);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(
    () => setCounterparty(requestedCounterparty),
    [requestedCounterparty],
  );
  useEffect(() => {
    api<{ events: HistoryEvent[] }>("/finance-events")
      .then((data) => setEvents(data.events))
      .finally(() => setLoading(false));
  }, []);
  const projects = useMemo(
    () =>
      unique(
        events
          .filter((event) => event.projectId)
          .map((event) => [event.projectId, event.projectName]),
      ),
    [events],
  );
  const counterparties = useMemo(
    () =>
      unique(
        events.map((event) => [event.counterpartyId, event.counterpartyName]),
      ),
    [events],
  );
  const filtersActive =
    filter !== "all" ||
    status !== "all" ||
    filterProject ||
    counterparty ||
    from ||
    to ||
    minAmount ||
    maxAmount;
  const visible = useMemo(() => {
    const normalizedQuery = query.toLowerCase().replace(/\s/g, "");
    return events.filter(
      (event) =>
        (!projectId || event.projectId === projectId) &&
        (!fundOnly || isFundEvent(event)) &&
        (filter === "all" || event.type === filter) &&
        (status === "all" || event.status === status) &&
        (!filterProject || event.projectId === filterProject) &&
        (!counterparty || event.counterpartyId === counterparty) &&
        (!from || event.eventDate >= from) &&
        (!to || event.eventDate <= to) &&
        (!minAmount || event.amount >= Number(minAmount)) &&
        (!maxAmount || event.amount <= Number(maxAmount)) &&
        `${title(event)} ${event.description} ${event.projectName} ${event.counterpartyName} ${event.relatedPartyName} ${event.tag} ${event.amount} ${money(event.amount)}`
          .toLowerCase()
          .replace(/\s/g, "")
          .includes(normalizedQuery),
    );
  }, [
    events,
    filter,
    status,
    filterProject,
    counterparty,
    from,
    to,
    minAmount,
    maxAmount,
    query,
    projectId,
    fundOnly,
  ]);
  function resetFilters() {
    setFilter("all");
    setStatus("all");
    setFilterProject("");
    setCounterparty("");
    setFrom("");
    setTo("");
    setMinAmount("");
    setMaxAmount("");
  }
  async function exportXlsx() {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "199";
    const sheet = workbook.addWorksheet("История");
    const columns: [string, string, number][] = [
      ["Дата", "date", 12],
      ["Событие", "event", 34],
      ["Статус", "status", 16],
      ["Проект", "project", 25],
      ["Контрагент", "counterparty", 25],
      ["Участник", "participant", 25],
      ["Описание", "description", 40],
      ["Тег", "tag", 18],
      ["Сумма", "amount", 14],
    ];
    sheet.columns = columns.map(([header, key, width]) => ({
      header,
      key,
      width,
    }));
    visible.forEach((event) =>
      sheet.addRow({
        date: date(event.eventDate),
        event: title(event),
        status: statusLabel(event.status),
        project: event.projectName,
        counterparty: event.counterpartyName,
        participant: event.relatedPartyName,
        description: event.description,
        tag: event.tag,
        amount: event.amount,
      }),
    );
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF168DDF" },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: "I1" };
    const blob = new Blob([await workbook.xlsx.writeBuffer()], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `История-событий-${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="light-page">
      <div className="mobile-page event-history-page">
        <PageHeader
          title={fundOnly ? "События Фонда компании" : "История событий"}
          onBack={fundOnly ? () => navigate("/company-fund") : undefined}
        />
        <div className="history-search">
          <label className="search-field">
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск"
            />
          </label>
          <button
            className={filtersActive ? "is-active" : ""}
            onClick={() => setFilterOpen(true)}
            aria-label="Фильтр"
          >
            <Filter />
          </button>
          <button
            onClick={() => void exportXlsx()}
            aria-label="Экспортировать найденные события в XLSX"
            disabled={!visible.length}
          >
            <Download />
          </button>
        </div>
        <p className="history-retention">
          События за последние 3 года · максимум 5 000 записей
          {filtersActive ? ` · найдено ${visible.length}` : ""}
        </p>
        {loading ? (
          <p className="counterparty-empty-events">Загрузка…</p>
        ) : !visible.length ? (
          <p className="counterparty-empty-events">События не найдены</p>
        ) : (
          <section className="history-list">
            {visible.map((event) => (
              <article
                className={`history-event history-event--${event.type} history-event--${event.status}`}
                key={event.id}
                onClick={() =>
                  navigate(
                    `/counterparties/${event.counterpartyId}/events/${event.id}`,
                    { state: { returnTo } },
                  )
                }
              >
                <header>
                  {event.status === "confirmed" ? (
                    <Check />
                  ) : event.status === "rejected" ? (
                    <X />
                  ) : (
                    <CircleDashed />
                  )}
                  <span>{title(event)}</span>
                </header>
                <small>
                  {date(event.eventDate)} / {date(event.createdAt.slice(0, 10))}
                </small>
                {event.description && <strong>{event.description}</strong>}
                {event.tag && <i>#{event.tag}</i>}
                {event.projectName && (
                  <p>
                    <Home />
                    {event.projectName}
                  </p>
                )}
                <p>
                  <UserRound />
                  {event.relatedPartyName || event.counterpartyName}
                </p>
                <footer>
                  <WalletCards />
                  {event.counterpartyName}
                  <b>{money(event.amount)} ₽</b>
                </footer>
              </article>
            ))}
          </section>
        )}
        {filterOpen && (
          <div className="sheet-backdrop">
            <section className="history-filter">
              <div className="sheet-heading">
                <button onClick={resetFilters}>Сбросить</button>
                <h2>Фильтры</h2>
                <button
                  className="icon-button"
                  onClick={() => setFilterOpen(false)}
                >
                  <X />
                </button>
              </div>
              <label>
                Тип события
                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as typeof filter)
                  }
                >
                  <option value="all">Все</option>
                  <option value="receipt">Поступления</option>
                  <option value="report">Отчёты</option>
                  <option value="transfer">Переводы</option>
                  <option value="estimate">Сметы</option>
                </select>
              </label>
              <label>
                Статус
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as typeof status)
                  }
                >
                  <option value="all">Все</option>
                  <option value="pending">Ожидает</option>
                  <option value="confirmed">Подтверждено</option>
                  <option value="rejected">Отклонено</option>
                </select>
              </label>
              <label>
                Проект
                <select
                  value={filterProject}
                  onChange={(event) => setFilterProject(event.target.value)}
                >
                  <option value="">Все проекты</option>
                  {projects.map(([id, name]) => (
                    <option value={id} key={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Контрагент
                <select
                  value={counterparty}
                  onChange={(event) => setCounterparty(event.target.value)}
                >
                  <option value="">Все контрагенты</option>
                  {counterparties.map(([id, name]) => (
                    <option value={id} key={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="history-filter-grid">
                <label>
                  С даты
                  <input
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                </label>
                <label>
                  По дату
                  <input
                    type="date"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </label>
                <label>
                  Сумма от
                  <input
                    type="number"
                    min="0"
                    value={minAmount}
                    onChange={(event) => setMinAmount(event.target.value)}
                  />
                </label>
                <label>
                  Сумма до
                  <input
                    type="number"
                    min="0"
                    value={maxAmount}
                    onChange={(event) => setMaxAmount(event.target.value)}
                  />
                </label>
              </div>
              <button
                className="primary-button"
                onClick={() => setFilterOpen(false)}
              >
                Показать {visible.length}
              </button>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
function title(event: HistoryEvent) {
  if (event.type === "transfer" && event.transferKind)
    return labels[event.transferKind];
  if (event.type === "receipt" && event.receiptDestination)
    return `${labels.receipt} ${labels[event.receiptDestination]}`;
  return labels[event.type];
}
function date(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}
function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
    value,
  );
}
function isFundEvent(event: HistoryEvent) {
  if (event.type === "receipt")
    return event.receiptDestination === "company_fund";
  if (event.type === "report" || event.type === "estimate")
    return !event.projectId;
  return ["fund_payment", "project_to_fund", "fund_to_project"].includes(
    event.transferKind,
  );
}
function statusLabel(status: Status) {
  return {
    pending: "Ожидает",
    confirmed: "Подтверждено",
    rejected: "Отклонено",
  }[status];
}
function unique(values: [string, string][]) {
  return [...new Map(values).entries()];
}
