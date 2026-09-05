import { useMemo } from "react";
import {
  BarChart3,
  Building2,
  ChevronRight,
  Landmark,
  List,
  Settings,
  Table2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { BrandLogo } from "../components/BrandLogo";
import { useCounterparties } from "../counterparties";
import {
  money,
  summarize,
  summarizeFund,
  summarizeProject,
  useFinanceEvents,
} from "../finance";
import { useProjects } from "../projects";

type CardProps = {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  onClick?: () => void;
  value?: string;
};

function DashboardCard({
  icon: Icon,
  title,
  children,
  onClick,
  value,
}: CardProps) {
  return (
    <button className="dashboard-card" onClick={onClick} disabled={!onClick}>
      <span className="dashboard-card__title">
        <Icon size={25} />
        <strong>{title}</strong>
      </span>
      {value && <span className="dashboard-card__value">{value}</span>}
      {onClick && (
        <ChevronRight className="dashboard-card__chevron" size={23} />
      )}
      {children}
    </button>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects } = useProjects();
  const { counterparties } = useCounterparties();
  const { events: financeEvents } = useFinanceEvents();
  const canEdit = user?.role === "organization";
  const myEvents = useMemo(
    () => financeEvents.filter((event) => event.counterpartyId === user?.id),
    [financeEvents, user?.id],
  );
  const accountableBalance = summarize(
    myEvents.filter((event) => event.receiptDestination !== "agent_fee"),
  ).balance;
  const fundBalance = summarizeFund(financeEvents).balance;
  const fundPendingReports = financeEvents.filter(
    (event) =>
      event.type === "report" && event.status === "pending" && !event.projectId,
  ).length;
  const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const recentEvents = financeEvents.filter(
    (event) => new Date(event.eventDate ?? 0).getTime() >= fourWeeksAgo,
  );
  const projectProfit = projects.reduce(
    (total, project) =>
      total + summarizeProject(recentEvents, project.id).balance,
    0,
  );
  const recentIncome = myEvents.reduce((sum, event) => {
    return event.status === "confirmed" &&
      event.type === "receipt" &&
      event.receiptDestination === "agent_fee" &&
      new Date(event.eventDate ?? 0).getTime() >= fourWeeksAgo
      ? sum + event.amount
      : sum;
  }, 0);
  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <div className="company-name">
              <BrandLogo compact /> {user?.organizationName}{" "}
              <ChevronRight size={20} />
            </div>
            <div className={`role-badge role-badge--${user?.role}`}>
              {canEdit ? "Организация · редактор" : "Клиент · просмотр"}
            </div>
            <p>ОБНОВЛЕНО ТОЛЬКО ЧТО</p>
          </div>
          <button
            className="icon-button icon-button--dark"
            onClick={() => navigate("/profile")}
            aria-label="Профиль и настройки"
          >
            <Settings size={27} />
          </button>
        </header>
        <section className="dashboard-cards">
          <DashboardCard
            icon={Building2}
            title="Проекты"
            value={String(projects.length)}
            onClick={() => navigate("/projects")}
          >
            <span className="dashboard-compact-metric">
              <span>Прибыль за 4 недели</span>
              <b>{money(projectProfit)}</b>
            </span>
          </DashboardCard>
          <DashboardCard
            icon={Users}
            title="Контрагенты"
            value={String(counterparties.length)}
            onClick={() => navigate("/counterparties")}
          >
            <span className="dashboard-compact-metric">
              <span>Подотчётный баланс</span>
              <b>{money(accountableBalance)}</b>
            </span>
            <span className="dashboard-compact-metric">
              <span>Доход за 4 недели</span>
              <b>{money(recentIncome)}</b>
            </span>
          </DashboardCard>
          <DashboardCard
            icon={Landmark}
            title="Фонд компании"
            onClick={() => navigate("/company-fund")}
          >
            <span className="dashboard-compact-metric">
              <span>Баланс фонда</span>
              <b>{money(fundBalance)}</b>
            </span>
            <span className="dashboard-compact-metric">
              <span>Непринятые отчёты</span>
              <b>{fundPendingReports}</b>
            </span>
          </DashboardCard>
          <DashboardCard
            icon={List}
            title="История событий"
            value=""
            onClick={() => navigate("/events")}
          />
          <DashboardCard
            icon={Table2}
            title="Прайс-листы"
            onClick={() => navigate("/price-lists")}
          />
          <DashboardCard
            icon={BarChart3}
            title="Аналитика"
            onClick={() => navigate("/analytics")}
          />
        </section>
      </div>
    </main>
  );
}
