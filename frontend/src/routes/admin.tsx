import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Upload, FileSpreadsheet, ArrowLeft, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE, authHeader, logout } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Админ-панель — Cargo Calculator" }] }),
});

interface PriceFile {
  carrier: string;
  filename: string | null;
  size: number;
  modified: number | null;
}

function AdminPage() {
  const navigate = useNavigate();
  const user = useAuth();
  const [files, setFiles] = useState<PriceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (user.role !== "admin") {
      navigate({ to: "/" });
    }
  }, [user, navigate]);

  const loadFiles = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/files`, { headers: authHeader() });
      if (!r.ok) throw new Error("Не удалось загрузить список файлов");
      const data = await r.json();
      setFiles(data.files || []);
    } catch (e: any) {
      setMsg({ type: "err", text: e.message });
    }
  };

  useEffect(() => {
    if (user?.role === "admin") loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onUpload = async (carrier: "rttk" | "brl", file: File) => {
    setLoading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`${API_BASE}/api/admin/upload?carrier=${carrier}`, {
        method: "POST",
        headers: authHeader(),
        body: form,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Ошибка загрузки");
      setMsg({ type: "ok", text: `Файл "${data.filename}" загружен для ${carrier.toUpperCase()}` });
      await loadFiles();
    } catch (e: any) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Проверка доступа...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="font-semibold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" /> Админ-панель
              </div>
              <div className="text-xs text-muted-foreground">{user.name}</div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logout();
              navigate({ to: "/login" });
            }}
          >
            Выйти
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Прайс-листы перевозчиков</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Загрузите обновлённые файлы (.xlsx, .xls, .csv) для РТТК и БРЛ.
            Файл заменит текущий прайс на сервере.
          </p>
        </div>

        {msg && (
          <div
            className={
              msg.type === "ok"
                ? "rounded-xl border border-success/40 bg-success/10 text-success px-4 py-3 text-sm flex items-center gap-2"
                : "rounded-xl border border-destructive/40 bg-destructive/10 text-destructive px-4 py-3 text-sm"
            }
          >
            {msg.type === "ok" && <CheckCircle2 className="h-4 w-4" />}
            {msg.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(["rttk", "brl"] as const).map((c) => {
            const f = files.find((x) => x.carrier === c);
            return (
              <div
                key={c}
                className="rounded-2xl bg-card border border-border p-6"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold uppercase">{c}</div>
                    <div className="text-xs text-muted-foreground">
                      {f?.filename || "Файл не загружен"}
                    </div>
                  </div>
                </div>

                {f?.filename && (
                  <div className="mt-4 text-xs text-muted-foreground">
                    Размер: {(f.size / 1024).toFixed(1)} КБ
                    {f.modified && (
                      <>
                        {" · "}
                        {new Date(f.modified * 1000).toLocaleString("ru-RU")}
                      </>
                    )}
                  </div>
                )}

                <label className="mt-5 block">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    disabled={loading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUpload(c, file);
                      e.target.value = "";
                    }}
                  />
                  <span
                    className={
                      "w-full inline-flex items-center justify-center gap-2 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 " +
                      (loading ? "opacity-50 pointer-events-none" : "")
                    }
                  >
                    <Upload className="h-4 w-4" />
                    {loading ? "Загрузка..." : "Загрузить файл"}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}