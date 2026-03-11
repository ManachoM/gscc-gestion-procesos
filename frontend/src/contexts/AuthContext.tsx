import { createContext, useContext, useEffect, useState } from "react";

export type Role = "admin" | "operator" | "viewer";

export interface AuthUser {
  sub: string; // email
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeToken(token: string): AuthUser | null {
  try {
    // JWT payload is the second base64url-encoded segment
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.sub || !payload.role) return null;
    return { sub: payload.sub, role: payload.role as Role };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = localStorage.getItem("token");
    return token ? decodeToken(token) : null;
  });

  // Keep user in sync if token is removed externally (e.g. another tab)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "token") setUser(e.newValue ? decodeToken(e.newValue) : null);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function login(token: string) {
    localStorage.setItem("token", token);
    setUser(decodeToken(token));
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
