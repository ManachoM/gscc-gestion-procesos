import { Fragment, FormEvent, useEffect, useState } from "react";
import { Pencil, Key, Trash2, Plus, X, Users } from "lucide-react";
import api from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { cn } from "../lib/cn";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Input";
import { PageHeader } from "../components/shared/PageHeader";
import { EmptyState } from "../components/shared/EmptyState";
import { Dialog, ConfirmDialog } from "../components/ui/Dialog";
import type { Role } from "../contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface User {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
}

type ApiError = { response?: { data?: { detail?: string } } };

function apiErr(err: unknown, fallback: string): string {
  return (err as ApiError)?.response?.data?.detail ?? fallback;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "operator", label: "Operator" },
  { value: "viewer", label: "Viewer" },
];

// ── Role pill ─────────────────────────────────────────────────────────────────

function RolePill({ role }: { role: Role }) {
  const classes: Record<Role, string> = {
    admin:
      "bg-blue-50 text-blue-700 border-blue-200",
    operator:
      "bg-emerald-50 text-emerald-700 border-emerald-200",
    viewer:
      "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        classes[role] ?? "bg-slate-100 text-slate-600 border-slate-200"
      )}
    >
      {role}
    </span>
  );
}

// ── Active badge ──────────────────────────────────────────────────────────────

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
      Inactive
    </span>
  );
}

// ── UserManagement ────────────────────────────────────────────────────────────

export default function UserManagement() {
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Add user form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("viewer");
  const [newActive, setNewActive] = useState(true);
  const [creating, setCreating] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<Role>("viewer");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password change dialog
  const [pwdUserId, setPwdUserId] = useState<number | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchUsers() {
    try {
      const { data } = await api.get<User[]>("/api/v1/users");
      setUsers(data);
    } catch (err) {
      setPageError(apiErr(err, "Failed to load users."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  // ── Create ───────────────────────────────────────────────────────────────

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/api/v1/users", {
        email: newEmail,
        password: newPassword,
        role: newRole,
        is_active: newActive,
      });
      toast("User created", "success");
      setNewEmail("");
      setNewPassword("");
      setNewRole("viewer");
      setNewActive(true);
      setShowAddForm(false);
      await fetchUsers();
    } catch (err) {
      setPageError(apiErr(err, "Failed to create user."));
    } finally {
      setCreating(false);
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────

  function startEdit(user: User) {
    setEditingId(user.id);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditActive(user.is_active);
    setPwdUserId(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/users/${editingId}`, {
        email: editEmail,
        role: editRole,
        is_active: editActive,
      });
      toast("User updated", "success");
      setEditingId(null);
      await fetchUsers();
    } catch (err) {
      setPageError(apiErr(err, "Failed to update user."));
    } finally {
      setSaving(false);
    }
  }

  // ── Password ─────────────────────────────────────────────────────────────

  function openChangePwd(user: User) {
    setPwdUserId(user.id);
    setNewPwd("");
    setEditingId(null);
  }

  async function handleChangePwd(e: FormEvent) {
    e.preventDefault();
    if (!pwdUserId) return;
    setChangingPwd(true);
    try {
      await api.patch(`/api/v1/users/${pwdUserId}/password`, {
        current_password: "",
        new_password: newPwd,
      });
      toast("Password updated", "success");
      setPwdUserId(null);
    } catch (err) {
      setPageError(apiErr(err, "Failed to change password."));
    } finally {
      setChangingPwd(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/users/${deleteTarget.id}`);
      toast("User deleted", "success");
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err) {
      setPageError(apiErr(err, "Failed to delete user."));
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <PageHeader
        title="User Management"
        description="Manage platform user accounts"
        className="mb-6"
      />

      {/* Error banner */}
      {pageError && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{pageError}</span>
          <button
            type="button"
            onClick={() => setPageError(null)}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Add User card */}
        <Card>
          <CardHeader>
            <CardTitle>Add User</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              icon={
                showAddForm ? (
                  <X className="size-3.5" />
                ) : (
                  <Plus className="size-3.5" />
                )
              }
              onClick={() => setShowAddForm((v) => !v)}
            >
              {showAddForm ? "Cancel" : "Add User"}
            </Button>
          </CardHeader>
          {showAddForm && (
            <CardContent>
              <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
                <Input
                  label="Email"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                />
                <Input
                  label="Password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <Select
                  label="Role"
                  required
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  options={ROLE_OPTIONS}
                />
                <div className="flex items-end pb-1">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newActive}
                      onChange={(e) => setNewActive(e.target.checked)}
                      className="size-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Active
                    </span>
                  </label>
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button type="submit" variant="primary" loading={creating}>
                    Create
                  </Button>
                </div>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Users table */}
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4">
                    <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <EmptyState
                icon={<Users className="size-5" />}
                title="No users found"
                className="py-10"
              />
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    {["Email", "Role", "Status", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <Fragment key={u.id}>
                      {/* User row */}
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {u.email}
                        </td>
                        <td className="px-4 py-3">
                          <RolePill role={u.role} />
                        </td>
                        <td className="px-4 py-3">
                          <ActiveBadge active={u.is_active} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Pencil className="size-3.5" />}
                              onClick={() =>
                                editingId === u.id
                                  ? setEditingId(null)
                                  : startEdit(u)
                              }
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Key className="size-3.5" />}
                              onClick={() =>
                                pwdUserId === u.id
                                  ? setPwdUserId(null)
                                  : openChangePwd(u)
                              }
                            >
                              Password
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600"
                              icon={<Trash2 className="size-3.5" />}
                              onClick={() => setDeleteTarget(u)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Inline edit row */}
                      {editingId === u.id && (
                        <tr>
                          <td
                            colSpan={4}
                            className="bg-slate-50 px-4 py-4 border-b border-slate-100"
                          >
                            <form
                              onSubmit={handleSave}
                              className="grid grid-cols-3 items-end gap-4"
                            >
                              <Input
                                label="Email"
                                type="email"
                                required
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                              />
                              <Select
                                label="Role"
                                value={editRole}
                                onChange={(e) =>
                                  setEditRole(e.target.value as Role)
                                }
                                options={ROLE_OPTIONS}
                              />
                              <div className="flex items-end gap-4 pb-1">
                                <label className="flex cursor-pointer items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={editActive}
                                    onChange={(e) =>
                                      setEditActive(e.target.checked)
                                    }
                                    className="size-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                  />
                                  <span className="text-sm font-medium text-slate-700">
                                    Active
                                  </span>
                                </label>
                                <div className="flex gap-2">
                                  <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    loading={saving}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setEditingId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* Change password dialog */}
      <Dialog
        open={pwdUserId !== null}
        onClose={() => setPwdUserId(null)}
        title="Change password"
        description="Set a new password for this user."
      >
        <form onSubmit={handleChangePwd} className="space-y-4">
          <Input
            label="New password"
            type="password"
            required
            autoFocus
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="••••••••"
          />
          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPwdUserId(null)}
              disabled={changingPwd}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={changingPwd}
            >
              Update password
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete user"
        description={`Delete "${deleteTarget?.email}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
