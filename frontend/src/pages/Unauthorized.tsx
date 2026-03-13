import { useNavigate } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { Button } from "../components/ui/Button";

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <ShieldX className="size-10 text-slate-300" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-slate-700">Access denied</h1>
          <p className="text-sm text-slate-500">
            You don't have permission to view this page.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Button variant="primary" size="sm" onClick={() => navigate("/dashboard")}>
            Go to dashboard
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate("/login")}>
            Sign in
          </Button>
        </div>
      </div>
    </div>
  );
}
