import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Unauthorized from "./pages/Unauthorized";
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
import UserManagement from "./pages/UserManagement";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Standalone pages — no layout */}
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* AppLayout wraps all other routes */}
            <Route element={<AppLayout />}>
              {/* Public — no auth required */}
              <Route path="/" element={<ArtifactBrowser />} />
              <Route path="/artifacts" element={<ArtifactBrowser />} />
              <Route path="/artifacts/:id" element={<ArtifactDetail />} />

              {/* Any authenticated user */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
              </Route>

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
                <Route path="/admin/users" element={<UserManagement />} />
                <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
