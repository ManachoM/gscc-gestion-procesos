import { Fragment, FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import type { Role } from "../contexts/AuthContext";

interface User {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
}

const ROLES: Role[] = ["admin", "operator", "viewer"];

const inputStyle: React.CSSProperties = { padding: "0.3rem 0.5rem", marginRight: "0.4rem" };
const btnStyle: React.CSSProperties = { padding: "0.3rem 0.7rem", marginRight: "0.4rem", cursor: "pointer" };
const tdStyle: React.CSSProperties = { padding: "0.5rem 1rem", borderBottom: "1px solid #ddd" };
const thStyle: React.CSSProperties = { ...tdStyle, background: "#f5f5f5", textAlign: "left" };

type ApiError = { response?: { data?: { detail?: string } } };

export default function AdminPanel() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("viewer");

  // Edit form
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<Role>("viewer");
  const [editActive, setEditActive] = useState(true);

  // Password change form
  const [changingPwdId, setChangingPwdId] = useState<number | null>(null);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");

  async function fetchUsers() {
    try {
      const { data } = await api.get<User[]>("/api/v1/users");
      setUsers(data);
    } catch {
      setError("Failed to load users.");
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/v1/users", { email: newEmail, password: newPassword, role: newRole });
      setNewEmail("");
      setNewPassword("");
      setNewRole("viewer");
      setCreating(false);
      await fetchUsers();
    } catch (err) {
      setError((err as ApiError)?.response?.data?.detail ?? "Failed to create user.");
    }
  }

  function startEdit(user: User) {
    setEditingId(user.id);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditActive(user.is_active);
    setChangingPwdId(null);
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.patch(`/api/v1/users/${editingId}`, {
        email: editEmail,
        role: editRole,
        is_active: editActive,
      });
      setEditingId(null);
      await fetchUsers();
    } catch (err) {
      setError((err as ApiError)?.response?.data?.detail ?? "Failed to update user.");
    }
  }

  async function handleDelete(id: number, email: string) {
    if (!window.confirm(`Delete user "${email}"?`)) return;
    try {
      await api.delete(`/api/v1/users/${id}`);
      await fetchUsers();
    } catch {
      setError("Failed to delete user.");
    }
  }

  function startChangePwd(user: User) {
    setChangingPwdId(user.id);
    setCurrentPwd("");
    setNewPwd("");
    setEditingId(null);
  }

  async function handleChangePwd(e: FormEvent) {
    e.preventDefault();
    try {
      await api.patch(`/api/v1/users/${changingPwdId}/password`, {
        current_password: currentPwd,
        new_password: newPwd,
      });
      setChangingPwdId(null);
    } catch (err) {
      setError((err as ApiError)?.response?.data?.detail ?? "Failed to change password.");
    }
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>User Management</h1>
        <div>
          <a href="/" style={{ marginRight: "1rem" }}>← Dashboard</a>
          <button style={btnStyle} onClick={() => { logout(); navigate("/login", { replace: true }); }}>
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <p style={{ color: "red", background: "#fff0f0", padding: "0.5rem 1rem", borderLeft: "4px solid red", marginBottom: "1rem" }}>
          {error}{" "}
          <button onClick={() => setError(null)} style={{ marginLeft: "0.5rem", cursor: "pointer" }}>✕</button>
        </p>
      )}

      {/* Create user */}
      <div style={{ marginBottom: "1.5rem" }}>
        {!creating ? (
          <button style={btnStyle} onClick={() => setCreating(true)}>+ New User</button>
        ) : (
          <form
            onSubmit={handleCreate}
            style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", background: "#f9f9f9", padding: "1rem", border: "1px solid #ddd" }}
          >
            <strong style={{ width: "100%", marginBottom: "0.25rem" }}>New user</strong>
            <input style={inputStyle} type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            <input style={inputStyle} type="password" placeholder="Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <select style={inputStyle} value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button style={btnStyle} type="submit">Create</button>
            <button style={btnStyle} type="button" onClick={() => setCreating(false)}>Cancel</button>
          </form>
        )}
      </div>

      {/* Users table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>Email</th>
            <th style={thStyle}>Role</th>
            <th style={thStyle}>Active</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <Fragment key={u.id}>
              <tr>
                <td style={tdStyle}>{u.id}</td>
                <td style={tdStyle}>{u.email}</td>
                <td style={tdStyle}>{u.role}</td>
                <td style={tdStyle}>{u.is_active ? "✓" : "✗"}</td>
                <td style={tdStyle}>
                  <button style={btnStyle} onClick={() => startEdit(u)}>Edit</button>
                  <button style={btnStyle} onClick={() => startChangePwd(u)}>Password</button>
                  <button style={{ ...btnStyle, color: "red" }} onClick={() => handleDelete(u.id, u.email)}>Delete</button>
                </td>
              </tr>

              {editingId === u.id && (
                <tr>
                  <td colSpan={5} style={{ padding: "0.75rem 1rem", background: "#f0f8ff", borderBottom: "1px solid #ddd" }}>
                    <form onSubmit={handleEdit} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                      <strong>Edit #{u.id}</strong>
                      <input style={inputStyle} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
                      <select style={inputStyle} value={editRole} onChange={(e) => setEditRole(e.target.value as Role)}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                        Active
                      </label>
                      <button style={btnStyle} type="submit">Save</button>
                      <button style={btnStyle} type="button" onClick={() => setEditingId(null)}>Cancel</button>
                    </form>
                  </td>
                </tr>
              )}

              {changingPwdId === u.id && (
                <tr>
                  <td colSpan={5} style={{ padding: "0.75rem 1rem", background: "#fffbf0", borderBottom: "1px solid #ddd" }}>
                    <form onSubmit={handleChangePwd} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                      <strong>Change password #{u.id}</strong>
                      <input style={inputStyle} type="password" placeholder="Current password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} required />
                      <input style={inputStyle} type="password" placeholder="New password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required />
                      <button style={btnStyle} type="submit">Update</button>
                      <button style={btnStyle} type="button" onClick={() => setChangingPwdId(null)}>Cancel</button>
                    </form>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", padding: "1.5rem", color: "#888" }}>
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
