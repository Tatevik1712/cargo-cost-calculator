import { useEffect, useState } from "react";
import { getAuth, type AuthUser } from "@/lib/auth";

export function useAuth(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(() => getAuth());
  useEffect(() => {
    const handler = () => setUser(getAuth());
    window.addEventListener("auth-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("auth-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return user;
}