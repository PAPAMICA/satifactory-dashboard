import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";
import { clearCredentials, PUBLIC_VIEWER_LOGIN, setCredentials } from "@/lib/auth";

type Tab = "account" | "public";

export function LoginPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("account");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [publicPass, setPublicPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmitAccount(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    setCredentials(user, pass);
    try {
      await apiFetch("/api/me");
      window.location.replace("/");
    } catch {
      clearCredentials();
      setErr(t("login.error"));
    } finally {
      setPending(false);
    }
  }

  async function onSubmitPublic(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    setCredentials(PUBLIC_VIEWER_LOGIN, publicPass);
    try {
      await apiFetch("/api/me");
      window.location.replace("/");
    } catch {
      clearCredentials();
      setErr(t("login.publicError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full min-w-0 items-center justify-center  px-3 py-8 sm:p-6">
      <div className="sf-login-aurora pointer-events-none absolute inset-0" aria-hidden />
      <div className="sf-login-grid pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />

      <div className="relative z-[1] w-full max-w-md min-w-0">
        <div className="sf-login-rise mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <img
              src="/ficsit.png"
              alt=""
              width={120}
              height={120}
              className={`sf-ficsit-mascot h-24 w-24 object-contain sm:h-28 sm:w-28 ${pending ? "sf-ficsit-bob" : ""}`}
            />
          </div>
          <p className="sf-display text-2xl font-semibold uppercase tracking-[0.2em] text-sf-orange sm:text-3xl">
            FICSIT
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.28em] text-sf-muted sm:text-sm">{t("login.brandLine")}</p>
        </div>

        <div className="sf-login-rise sf-login-rise-delay-1 sf-login-card-glow sf-panel  shadow-2xl ring-1 ring-black/50">
          <div className="sf-panel-header flex flex-wrap items-center justify-between gap-2">
            <span>{t("login.title")}</span>
            <div className="flex rounded border border-sf-border/60 bg-black/30 p-0.5 text-[0.65rem] uppercase tracking-wider">
              <button
                type="button"
                className={`rounded px-2 py-1 transition-colors ${
                  tab === "account" ? "bg-sf-orange/25 text-sf-orange" : "text-sf-muted hover:text-sf-text"
                }`}
                onClick={() => {
                  setTab("account");
                  setErr(null);
                }}
              >
                {t("login.tabAccount")}
              </button>
              <button
                type="button"
                className={`rounded px-2 py-1 transition-colors ${
                  tab === "public" ? "bg-sf-cyan/20 text-sf-cyan" : "text-sf-muted hover:text-sf-text"
                }`}
                onClick={() => {
                  setTab("public");
                  setErr(null);
                }}
              >
                {t("login.tabPublic")}
              </button>
            </div>
          </div>

          {tab === "account" ?
            <form onSubmit={onSubmitAccount} className="sf-login-rise sf-login-rise-delay-2 space-y-4 p-4 sm:p-6">
              <p className="text-sm leading-relaxed text-sf-muted">{t("login.subtitle")}</p>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-sf-muted">{t("login.user")}</label>
                <input
                  className="sf-input min-h-11 w-full text-base transition-shadow duration-300 focus:shadow-[0_0_0_1px_rgba(255,154,26,0.35)] sm:min-h-0 sm:text-sm"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-sf-muted">{t("login.pass")}</label>
                <input
                  className="sf-input min-h-11 w-full text-base transition-shadow duration-300 focus:shadow-[0_0_0_1px_rgba(255,154,26,0.35)] sm:min-h-0 sm:text-sm"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {err ? <p className="text-sm text-sf-danger">{err}</p> : null}
              <button
                type="submit"
                className="sf-btn sf-btn-primary min-h-12 w-full transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] sm:min-h-0"
                disabled={pending}
              >
                {t("login.submit")}
              </button>
            </form>
          : <form onSubmit={onSubmitPublic} className="sf-login-rise sf-login-rise-delay-2 space-y-4 p-4 sm:p-6">
              <p className="text-sm font-medium text-sf-cream">{t("login.publicTitle")}</p>
              <p className="text-xs leading-relaxed text-sf-muted">{t("login.publicSubtitle")}</p>
              <p className="rounded border border-sf-border/60 bg-black/25 px-2 py-1.5 text-[0.65rem] text-sf-muted">
                {t("login.publicUserHint", { user: PUBLIC_VIEWER_LOGIN })}
              </p>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-sf-muted">{t("login.publicPass")}</label>
                <input
                  className="sf-input min-h-11 w-full text-base transition-shadow duration-300 focus:shadow-[0_0_0_1px_rgba(95,212,255,0.35)] sm:min-h-0 sm:text-sm"
                  type="password"
                  value={publicPass}
                  onChange={(e) => setPublicPass(e.target.value)}
                  autoComplete="off"
                />
              </div>
              {err ? <p className="text-sm text-sf-danger">{err}</p> : null}
              <button
                type="submit"
                className="sf-btn min-h-12 w-full border-sf-cyan/50 bg-gradient-to-b from-sf-cyan/15 to-black/40 text-sf-cyan transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] sm:min-h-0"
                disabled={pending || !publicPass}
              >
                {t("login.publicSubmit")}
              </button>
            </form>
          }
        </div>
      </div>
    </div>
  );
}
