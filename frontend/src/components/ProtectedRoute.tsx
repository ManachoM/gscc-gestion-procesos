import { Navigate, Outlet } from "react-router-dom";
import { useAuth, type Role } from "../contexts/AuthContext";

interface Props {
  requiredRole?: Role | Role[];
}

function hasRequiredRole(userRole: Role, required: Role | Role[]): boolean {
  return Array.isArray(required) ? required.includes(userRole) : userRole === required;
}

export default function ProtectedRoute({ requiredRole }: Props) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && !hasRequiredRole(user.role, requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
