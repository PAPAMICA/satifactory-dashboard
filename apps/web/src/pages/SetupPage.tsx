import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";

export function SetupPage({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setPending(true);
    try {
      await apiFetch("/api/setup", { method: "POST", json: { username: user, password: pass } });
      setMsg(t("setup.success"));
      setTimeout(onDone, 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] w-full min-w-0 items-center justify-center px-3 py-6 sf-grid-bg sm:p-4">
      <div className="sf-panel w-full min-w-0 ">
        <div className="sf-panel-header">{t("setup.title")}</div>
        <form onSubmit={onSubmit} className="space-y-4 p-4 sm:p-6">
          <p className="text-sm leading-relaxed text-sf-muted">{t("setup.subtitle")}</p>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-sf-muted">
              {t("login.user")}
            </label>
            <input
              className="sf-input min-h-11 w-full text-base sm:min-h-0 sm:text-sm"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-sf-muted">
              {t("login.pass")}
            </label>
            <input
              className="sf-input min-h-11 w-full text-base sm:min-h-0 sm:text-sm"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {err ? <p className="text-sm text-sf-danger">{err}</p> : null}
          {msg ? <p className="text-sm text-sf-ok">{msg}</p> : null}
          <button
            type="submit"
            className="sf-btn sf-btn-primary min-h-12 w-full text-sm sm:min-h-0"
            disabled={pending}
          >
            {t("setup.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
