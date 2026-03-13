import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../../contexts/AuthContext";

export default function AppLayout() {
  const { user } = useAuth();

  // Public pages (no sidebar)
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PublicHeader />
        <main>
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary-600">
            <span className="text-white text-xs font-bold">G</span>
          </div>
          <span className="text-sm font-semibold text-slate-900">GSCC</span>
        </div>
        <a
          href="/login"
          className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          Sign in →
        </a>
      </div>
    </header>
  );
}
