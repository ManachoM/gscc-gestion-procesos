import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GitBranch, Search, Play, Clock } from "lucide-react";
import api from "../lib/api";
import { apiError, type Workflow } from "../types";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatusBadge } from "../components/shared/StatusBadge";
import { PageHeader } from "../components/shared/PageHeader";
import { EmptyState } from "../components/shared/EmptyState";
import { TableSkeleton } from "../components/ui/Skeleton";

export default function WorkflowCatalog() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .get<Workflow[]>("/api/v1/workflows")
      .then(({ data }) => setWorkflows(data))
      .catch((err) => setError(apiError(err, "Failed to load workflows.")))
      .finally(() => setLoading(false));
  }, []);

  const filtered = workflows.filter((wf) => {
    const q = search.toLowerCase();
    return (
      wf.name.toLowerCase().includes(q) || wf.slug.toLowerCase().includes(q)
    );
  });

  return (
    <div className="px-8 py-8">
      <PageHeader
        title="Workflows"
        description="Browse and trigger extraction workflows"
      />

      {/* Search bar */}
      <div className="mt-6 mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or slug…"
          className="h-9 w-full rounded border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<GitBranch className="size-6" />}
            title="No workflows available"
            description={
              search
                ? "No workflows match your search. Try a different term."
                : "Contact an admin to publish a workflow"
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((wf) => (
                  <tr
                    key={wf.slug}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/workflows/${wf.slug}/run`)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                      {wf.name}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <code className="font-mono text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        {wf.slug}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 truncate max-w-xs">
                      {wf.description ?? (
                        <span className="italic text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <StatusBadge status={wf.status} />
                    </td>
                    <td
                      className="px-4 py-3 text-sm whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<Play className="size-3" />}
                          onClick={() => navigate(`/workflows/${wf.slug}/run`)}
                        >
                          Run now
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Clock className="size-3" />}
                          onClick={() =>
                            navigate(`/schedules/new?workflow=${wf.slug}`)
                          }
                        >
                          Schedule
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
