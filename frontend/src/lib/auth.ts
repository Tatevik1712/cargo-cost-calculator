const STORAGE_KEY = "cargo_auth";
import { API_BASE_URL } from "@/config";

export interface AuthUser {
  username: string;
  role: "admin" | "user";
  name: string;
  token: string;
}

export function getAuth(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setAuth(u: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("auth-changed"));
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Неверный логин или пароль");
  }
  const data = await res.json();
  const user: AuthUser = {
    username: data.username,
    role: data.role,
    name: data.name,
    token: data.access_token,
  };
  setAuth(user);
  return user;
}

export function logout() {
  setAuth(null);
}

export function authHeader(): Record<string, string> {
  const u = getAuth();
  return u ? { Authorization: `Bearer ${u.token}` } : {};
}

export { API_BASE_URL as API_BASE };