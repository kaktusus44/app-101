import { Building2, History, Home, Plus, Users } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { EventCreateMenu } from "./EventCreateMenu";

const editorRoutes = [
  /^\/projects\/new$/,
  /^\/projects\/[^/]+\/edit$/,
  /^\/projects\/[^/]+\/expense-articles\/(?:new|[^/]+\/edit)$/,
  /^\/price-lists\/new$/,
  /^\/price-lists\/[^/]+\/items\//,
  /^\/counterparties\/invite$/,
  /^\/counterparties\/[^/]+\/events\//,
  /^\/counterparties\/[^/]+\/reconciliation$/,
];

export function AppShell() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = [undefined, "new", "photo-album-help"].includes(
    projectMatch?.[1],
  )
    ? ""
    : (projectMatch?.[1] ?? "");
  const counterpartyMatch = pathname.match(/^\/counterparties\/([^/]+)$/);
  const counterpartyId =
    counterpartyMatch?.[1] && counterpartyMatch[1] !== "invite"
      ? counterpartyMatch[1]
      : "me";
  const showNavigation = !editorRoutes.some((pattern) =>
    pattern.test(pathname),
  );
  const canEdit = user?.role === "organization";

  return (
    <>
      <div
        className={
          showNavigation ? "app-content app-content--with-nav" : "app-content"
        }
      >
        <Outlet />
      </div>
      {showNavigation && (
        <nav
          className={`bottom-nav${canEdit ? " bottom-nav--with-action" : ""}`}
          aria-label="Основная навигация"
        >
          <NavItem to="/" label="Главная" icon={Home} />
          <NavItem to="/projects" label="Проекты" icon={Building2} />
          {canEdit && (
            <button
              className="bottom-nav__create"
              type="button"
              onClick={() => setEventMenuOpen(true)}
              aria-label="Добавить событие"
            >
              <Plus />
            </button>
          )}
          <NavItem to="/counterparties" label="Контрагенты" icon={Users} />
          <NavItem to="/events" label="История" icon={History} />
        </nav>
      )}
      <EventCreateMenu
        open={eventMenuOpen}
        onClose={() => setEventMenuOpen(false)}
        returnTo={pathname}
        projectId={projectId}
        counterpartyId={counterpartyId}
      />
    </>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof Home;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `bottom-nav__item${isActive ? " is-active" : ""}`
      }
    >
      <Icon />
      <span>{label}</span>
    </NavLink>
  );
}
