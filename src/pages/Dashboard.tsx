import { useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  ChevronRight,
  Landmark,
  List,
  Plus,
  Settings,
  Table2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { BrandLogo } from "../components/BrandLogo";
import { EventCreateMenu } from "../components/EventCreateMenu";
import { money, summarize, summarizeFund, summarizeProject, useFinanceEvents } from "../finance";
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
  const { events: financeEvents } = useFinanceEvents();
  const canEdit = user?.role === "organization";
  const [menuOpen, setMenuOpen] = useState(false);
  const myEvents = useMemo(() => financeEvents.filter((event) => event.counterpartyId === user?.id), [financeEvents, user?.id]);
  const accountableBalance = summarize(myEvents.filter((event) => event.receiptDestination !== "agent_fee")).balance;
  const fundBalance = summarizeFund(financeEvents).balance;
  const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const recentEvents = financeEvents.filter((event) => new Date(event.eventDate ?? 0).getTime() >= fourWeeksAgo);
  const projectProfit = projects.reduce((total, project) => total + summarizeProject(recentEvents, project.id).balance, 0);
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
            <span className="metric">{money(projectProfit)}</span>
            <span className="muted">
              прибыли по всем проектам за <b>4 недели</b>
            </span>
          </DashboardCard>
          <DashboardCard
            icon={Users}
            title="Контрагенты"
            onClick={() => navigate("/counterparties")}
          >
            <span className="metric">{money(accountableBalance)}</span>
            <span className="muted">
              мой подотчётный баланс по проектам и фонду компании
            </span>
            <span className="metric">{money(recentIncome)}</span>
            <span className="muted">
              мой доход за <b>4 недели</b>
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
            icon={Landmark}
            title="Фонд компании"
            onClick={() => navigate("/company-fund")}
          >
            <span className="metric">{money(fundBalance)}</span>
            <span className="muted">баланс Фонда компании</span>
          </DashboardCard>
          <DashboardCard
            icon={BarChart3}
            title="Аналитика"
            onClick={() => navigate("/analytics")}
          />
        </section>
        {canEdit && (
          <button
            className="fab"
            onClick={() => setMenuOpen(true)}
            aria-label="Добавить событие"
          >
            <Plus size={38} />
          </button>
        )}
      </div>
      <EventCreateMenu open={menuOpen} onClose={() => setMenuOpen(false)} returnTo="/" />
    </main>
  );
}
