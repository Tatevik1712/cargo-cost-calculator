import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Truck, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Вход — Cargo Calculator" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const u = await login(username.trim(), password);
      navigate({ to: u.role === "admin" ? "/admin" : "/" });
    } catch (err: any) {
      setError(err?.message || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div
        className="w-full max-w-md rounded-3xl bg-card border border-border p-8"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold">Cargo Calculator</div>
            <div className="text-xs text-muted-foreground">Вход в систему</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Логин</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin или user"
              className="h-11 mt-1.5"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Пароль</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 mt-1.5"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading || !username || !password} className="w-full h-11">
            <LogIn className="h-4 w-4 mr-2" />
            {loading ? "Вход..." : "Войти"}
          </Button>
        </form>

        <div className="mt-6 text-xs text-muted-foreground border-t border-border pt-4 space-y-1">
          <div className="font-medium text-foreground/80">Тестовые аккаунты:</div>
          <div>Админ: <code className="text-foreground">admin</code> / <code className="text-foreground">admin123</code></div>
          <div>Пользователь: <code className="text-foreground">user</code> / <code className="text-foreground">user123</code></div>
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← На главную
          </Link>
        </div>
      </div>
    </div>
  );
}