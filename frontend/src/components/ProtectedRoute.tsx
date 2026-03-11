import { Navigate, Outlet } from "react-router-dom";
import { useAuth, type Role } from "../contexts/AuthContext";

interface Props {
  requiredRole?: Role;
}

export default function ProtectedRoute({ requiredRole }: Props) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/unauthorized" replace />;

  return <Outlet />;
}
