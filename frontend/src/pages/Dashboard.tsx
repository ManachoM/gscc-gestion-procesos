import { Link } from "react-router-dom";
import {
  Package,
  GitBranch,
  PlayCircle,
  Calendar,
  Settings2,
  Users,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface NavCard {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function DashboardCard({ to, icon, title, description }: NavCard) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow duration-150"
    >
      <div className="flex-shrink-0 flex items-center justify-center rounded-lg bg-primary-50 text-primary-600 p-2">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <ChevronRight size={16} className="flex-shrink-0 text-slate-300" />
    </Link>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const isOperator = user?.role === "operator" || user?.role === "admin";
  const isAdmin = user?.role === "admin";

  const alwaysCards: NavCard[] = [
    {
      to: "/artifacts",
      icon: <Package size={18} />,
      title: "Artifact Catalog",
      description: "Browse and download published geospatial files",
    },
  ];

  const operatorCards: NavCard[] = [
    {
      to: "/workflows",
      icon: <GitBranch size={18} />,
      title: "Workflows",
      description: "Browse and trigger extraction workflows",
    },
    {
      to: "/executions",
      icon: <PlayCircle size={18} />,
      title: "Runs",
      description: "Monitor and inspect your workflow runs",
    },
    {
      to: "/schedules",
      icon: <Calendar size={18} />,
      title: "Schedules",
      description: "Manage recurring and one-time workflow schedules",
    },
  ];

  const adminCards: NavCard[] = [
    {
      to: "/admin/workflows",
      icon: <Settings2 size={18} />,
      title: "Manage Workflows",
      description: "Publish, archive, and inspect workflow definitions",
    },
    {
      to: "/admin/users",
      icon: <Users size={18} />,
      title: "User Management",
      description: "Create, edit, and manage platform users",
    },
  ];

  const cards: NavCard[] = [
    ...alwaysCards,
    ...(isOperator ? operatorCards : []),
    ...(isAdmin ? adminCards : []),
  ];

  return (
    <div className="py-8 px-8">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          {getGreeting()}, {user?.sub}
        </h1>
        <p className="text-sm text-slate-500 mt-1">Here's what's happening today.</p>
      </div>

      {/* Nav card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <DashboardCard key={card.to} {...card} />
        ))}
      </div>
    </div>
  );
}
