import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Images,
  List,
  MapPin,
  Maximize,
  Pencil,
  Table2,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth";
import { useCounterparties } from "../counterparties";
import { PageHeader } from "../components/PageHeader";
import { money } from "../finance";
import { useProjects } from "../projects";

const sections = [
  { label: "События", icon: List },
  { label: "Статьи расходов", icon: BarChart3 },
  { label: "Участники", icon: Users },
  { label: "Документы", icon: FileText },
  { label: "Прайс-лист", icon: Table2, caption: "Не выбран" },
  { label: "Получатели агентского вознаграждения", icon: CircleDollarSign },
  { label: "Партнёры", icon: Users },
  { label: "Руководитель проекта", icon: UserRound },
];

export function ProjectDetails() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, loading, deleteProject, updateProject } = useProjects();
  const { counterparties } = useCounterparties();
  const [albumOpen, setAlbumOpen] = useState(false);
  const [albumUrl, setAlbumUrl] = useState("");
  const [albumError, setAlbumError] = useState("");
  const project = projects.find((candidate) => candidate.id === projectId);
  const canEdit = user?.role === "organization";
  const customerName = normalizeName(project?.customer ?? "");
  const customer =
    (project &&
      counterparties.find((item) => item.id === project.customerId)) ||
    counterparties.find((item) => normalizeName(item.name) === customerName) ||
    counterparties.find(
      (item) =>
        normalizeName(item.name).includes(customerName) ||
        customerName.includes(normalizeName(item.name)),
    );
  if (loading)
    return (
      <main className="light-page">
        <div className="mobile-page">
          <p className="empty-state">Загрузка проекта…</p>
        </div>
      </main>
    );
  if (!project) return <Navigate to="/projects" replace />;
  const finances = {
    balance: project.balance,
    income: project.income,
    expense: project.expense,
  };
  return (
    <>
      <main className="light-page">
        <div className="mobile-page project-details-page">
          <PageHeader
            title=""
            actions={
              canEdit ? (
                <>
                  <button
                    className="icon-button project-delete-button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Удалить проект «${project.name}»? Финансовые события останутся в истории.`,
                        )
                      ) {
                        deleteProject(project.id);
                        navigate("/projects", { replace: true });
                      }
                    }}
                    aria-label="Удалить проект"
                  >
                    <Trash2 />
                  </button>
                  <button
                    className="icon-button icon-button--blue"
                    onClick={() => navigate(`/projects/${project.id}/edit`)}
                    aria-label="Редактировать проект"
                  >
                    <Pencil />
                  </button>
                </>
              ) : undefined
            }
          />
          <section className="project-summary">
            <h1>{project.name}</h1>
            <strong>{project.shortName}</strong>
            <button
              className="project-customer-link"
              onClick={() =>
                customer && navigate(`/counterparties/${customer.id}`)
              }
              disabled={!customer}
            >
              <UserRound />
              {project.customer}
              <ChevronRight />
            </button>
            <p>
              <CalendarDays />
              {formatDate(project.completionDate)}
            </p>
            <p>
              <Maximize />
              {project.area} м²
            </p>
            <p>
              <MapPin />
              {project.address}
            </p>
          </section>
          <section className="finance-summary">
            <span>
              Баланс <b>{money(finances.balance)}</b>
            </span>
            <span>
              Поступление <b>{money(finances.income)}</b>
            </span>
            <span>
              Расход <b>{money(finances.expense)}</b>
            </span>
          </section>
          <section className="project-menu">
            {sections
              .slice(0, 3)
              .map((section) =>
                renderSection(
                  section,
                  section.label === "События"
                    ? () =>
                        navigate(
                          `/events?projectId=${encodeURIComponent(project.id)}`,
                        )
                    : section.label === "Статьи расходов"
                      ? () =>
                          navigate(`/projects/${project.id}/expense-articles`)
                      : section.label === "Участники"
                        ? () => navigate(`/projects/${project.id}/participants`)
                        : undefined,
                ),
              )}
            <button
              onClick={() => {
                if (project.photoAlbumUrl)
                  window.open(
                    project.photoAlbumUrl,
                    "_blank",
                    "noopener,noreferrer",
                  );
                else if (canEdit) {
                  setAlbumUrl("");
                  setAlbumError("");
                  setAlbumOpen(true);
                }
              }}
            >
              <Images />
              <span>
                Общий фотоальбом
                <small>
                  {project.photoAlbumUrl
                    ? "Открыть альбом"
                    : canEdit
                      ? "Добавить ссылку"
                      : "Ещё не добавлен"}
                </small>
              </span>
              <ChevronRight />
            </button>
            {canEdit && project.photoAlbumUrl && (
              <button
                onClick={() => {
                  setAlbumUrl(project.photoAlbumUrl);
                  setAlbumError("");
                  setAlbumOpen(true);
                }}
              >
                <Pencil />
                <span>
                  Настроить фотоальбом<small>Изменить или удалить ссылку</small>
                </span>
                <ChevronRight />
              </button>
            )}
            <button onClick={() => navigate("/projects/photo-album-help")}>
              <BookOpen />
              <span>
                Как настроить фотоальбом<small>Android и iOS</small>
              </span>
              <ChevronRight />
            </button>
            {sections
              .slice(3)
              .map((section) =>
                renderSection(
                  section,
                  section.label === "Документы"
                    ? () => navigate(`/projects/${project.id}/documents`)
                    : section.label === "Прайс-лист"
                      ? () => navigate("/price-lists")
                      : section.label === "Получатели агентского вознаграждения"
                        ? () =>
                            navigate(
                              `/projects/${project.id}/agent-fee-recipients`,
                            )
                        : section.label === "Партнёры"
                          ? () => navigate("/counterparties?category=partner")
                          : section.label === "Руководитель проекта"
                            ? () =>
                                navigate(`/projects/${project.id}/participants`)
                            : undefined,
                ),
              )}
          </section>
        </div>
      </main>
      {albumOpen && (
        <div className="sheet-backdrop" onClick={() => setAlbumOpen(false)}>
          <form
            className="project-album-sheet"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              const value = albumUrl.trim();
              try {
                const url = new URL(value);
                if (!["http:", "https:"].includes(url.protocol))
                  throw new Error();
                updateProject(project.id, { ...project, photoAlbumUrl: value });
                setAlbumOpen(false);
              } catch {
                setAlbumError(
                  "Укажите корректную ссылку, начинающуюся с http:// или https://",
                );
              }
            }}
          >
            <div className="sheet-heading">
              <h2>
                {project.photoAlbumUrl
                  ? "Общий фотоальбом"
                  : "Добавить фотоальбом"}
              </h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setAlbumOpen(false)}
                aria-label="Закрыть"
              >
                <X />
              </button>
            </div>
            <p>
              Вставьте публичную ссылку на альбом в Яндекс Диске, Google Фото
              или другом облаке.
            </p>
            <input
              autoFocus
              type="url"
              placeholder="https://disk.yandex.ru/d/..."
              value={albumUrl}
              onChange={(event) => {
                setAlbumUrl(event.target.value);
                setAlbumError("");
              }}
              required
            />
            {albumError && <p className="form-error">{albumError}</p>}
            <button className="primary-button">Сохранить ссылку</button>
            {project.photoAlbumUrl && (
              <button
                className="project-album-delete"
                type="button"
                onClick={() => {
                  if (window.confirm("Удалить ссылку на общий фотоальбом?")) {
                    updateProject(project.id, {
                      ...project,
                      photoAlbumUrl: "",
                    });
                    setAlbumOpen(false);
                  }
                }}
              >
                <Trash2 />
                Удалить ссылку
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
function renderSection(
  { label, icon: Icon, caption }: (typeof sections)[number],
  onClick?: () => void,
) {
  return (
    <button key={label} onClick={onClick}>
      <Icon />
      <span>
        {label}
        {caption && <small>{caption}</small>}
      </span>
      <ChevronRight />
    </button>
  );
}
function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}
function normalizeName(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
