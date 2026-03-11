import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

// Existing pages (keep as-is, they manage their own layout)
import Login from "./pages/Login";
import AdminPanel from "./pages/AdminPanel";
import Unauthorized from "./pages/Unauthorized";

// New pages (wrapped in Layout)
import Dashboard from "./pages/Dashboard";
import ArtifactBrowser from "./pages/ArtifactBrowser";
import ArtifactDetail from "./pages/ArtifactDetail";
import WorkflowCatalog from "./pages/WorkflowCatalog";
import RunForm from "./pages/RunForm";
import ExecutionList from "./pages/ExecutionList";
import ExecutionDetail from "./pages/ExecutionDetail";
import ScheduleList from "./pages/ScheduleList";
import ScheduleForm from "./pages/ScheduleForm";
import AdminWorkflows from "./pages/AdminWorkflows";
import AdminWorkflowDetail from "./pages/AdminWorkflowDetail";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Standalone pages — manage their own layout/nav */}
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Admin panel (existing, standalone) */}
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="/admin" element={<AdminPanel />} />
          </Route>

          {/* All other pages use the shared Layout (nav bar + outlet) */}
          <Route element={<Layout />}>
            {/* Public — no auth required */}
            <Route path="/" element={<ArtifactBrowser />} />
            <Route path="/artifacts" element={<ArtifactBrowser />} />
            <Route path="/artifacts/:id" element={<ArtifactDetail />} />

            {/* Authenticated */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Operator + Admin */}
              <Route element={<ProtectedRoute requiredRole={["admin", "operator"]} />}>
                <Route path="/workflows" element={<WorkflowCatalog />} />
                <Route path="/workflows/:slug/run" element={<RunForm />} />
                <Route path="/executions" element={<ExecutionList />} />
                <Route path="/executions/:id" element={<ExecutionDetail />} />
                <Route path="/schedules" element={<ScheduleList />} />
                <Route path="/schedules/new" element={<ScheduleForm />} />
              </Route>

              {/* Admin only */}
              <Route element={<ProtectedRoute requiredRole="admin" />}>
                <Route path="/admin/workflows" element={<AdminWorkflows />} />
                <Route path="/admin/workflows/:slug" element={<AdminWorkflowDetail />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
