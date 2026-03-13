import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  PlayCircle,
  Calendar,
  Package,
  Users,
  Settings2,
  LogOut,
  GitFork,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { useAuth } from "../../contexts/AuthContext";

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles?: string[];
}

const mainNav: NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: <LayoutDashboard className="size-4" />,
  },
  {
    label: "Workflows",
    to: "/workflows",
    icon: <GitBranch className="size-4" />,
    roles: ["admin", "operator"],
  },
  {
    label: "Runs",
    to: "/executions",
    icon: <PlayCircle className="size-4" />,
    roles: ["admin", "operator"],
  },
  {
    label: "Schedules",
    to: "/schedules",
    icon: <Calendar className="size-4" />,
    roles: ["admin", "operator"],
  },
  {
    label: "Artifact Catalog",
    to: "/artifacts",
    icon: <Package className="size-4" />,
  },
];

const adminNav: NavItem[] = [
  {
    label: "Manage Workflows",
    to: "/admin/workflows",
    icon: <Settings2 className="size-4" />,
    roles: ["admin"],
  },
  {
    label: "User Management",
    to: "/admin/users",
    icon: <Users className="size-4" />,
    roles: ["admin"],
  },
];

function NavEntry({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors",
          isActive
            ? "bg-primary-600 text-white font-medium"
            : "text-slate-400 hover:bg-slate-800 hover:text-white"
        )
      }
    >
      {item.icon}
      {item.label}
    </NavLink>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const role = user?.role ?? "";

  const visibleMain = mainNav.filter(
    (item) => !item.roles || item.roles.includes(role)
  );
  const visibleAdmin = adminNav.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="flex h-full w-64 flex-col bg-slate-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-600">
          <GitFork className="size-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none">GSCC</p>
          <p className="mt-0.5 text-[11px] text-slate-500 truncate">Gestión de Procesos</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          Main
        </div>
        {visibleMain.map((item) => (
          <NavEntry key={item.to} item={item} />
        ))}

        {visibleAdmin.length > 0 && (
          <>
            <div className="mt-6 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Administration
            </div>
            {visibleAdmin.map((item) => (
              <NavEntry key={item.to} item={item} />
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-800 px-3 py-3">
        <div className="flex items-center gap-2.5 rounded px-3 py-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600/20 text-primary-400 text-xs font-semibold">
            {user?.sub?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-300">{user?.sub}</p>
            <p className="text-[10px] text-slate-500 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
