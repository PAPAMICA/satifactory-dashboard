import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FicsitPageLoader } from "@/components/FicsitPageLoader";
import { apiFetch } from "@/lib/api";
import { PUBLIC_VIEWER_LOGIN } from "@/lib/auth";

type Settings = {
  frmBaseUrl: string;
  frmTokenConfigured: boolean;
  pollIntervalMs: number;
  publicViewerPasswordConfigured?: boolean;
};

type Me = { isAdmin: boolean };

export function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<Me>("/api/me"),
  });
  const { data: s, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<Settings>("/api/settings"),
  });

  const [frmBaseUrl, setFrmBaseUrl] = useState("");
  const [frmToken, setFrmToken] = useState("");
  const [poll, setPoll] = useState(10_000);
  const [pubPass, setPubPass] = useState("");
  const [pubPass2, setPubPass2] = useState("");
  const [revokePub, setRevokePub] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!s) return;
    setFrmBaseUrl(s.frmBaseUrl);
    setPoll(s.pollIntervalMs);
  }, [s]);

  const save = useMutation({
    mutationFn: (body: {
      frmBaseUrl?: string;
      frmToken?: string;
      pollIntervalMs?: number;
      publicViewerPassword?: string;
      publicViewerPasswordConfirm?: string;
      clearPublicViewerPassword?: boolean;
    }) => apiFetch("/api/settings", { method: "PUT", json: body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings"] });
      setMsg("OK");
      setFrmToken("");
      setPubPass("");
      setPubPass2("");
      setRevokePub(false);
      setTimeout(() => setMsg(null), 2000);
    },
    onError: (e: Error) => setErr(e.message),
  });

  const test = useMutation({
    mutationFn: () => apiFetch<unknown>("/api/frm/getSessionInfo"),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!me?.isAdmin) {
      setErr(t("settings.adminOnly"));
      return;
    }
    if (revokePub) {
      save.mutate({
        frmBaseUrl,
        pollIntervalMs: poll,
        clearPublicViewerPassword: true,
        ...(frmToken.trim() ? { frmToken: frmToken.trim() } : {}),
      });
      return;
    }
    if (pubPass.length > 0 || pubPass2.length > 0) {
      if (pubPass !== pubPass2) {
        setErr(t("settings.publicViewerMismatch"));
        return;
      }
      if (pubPass.length < 4) {
        setErr(t("settings.publicViewerTooShort"));
        return;
      }
    }
    const body: {
      frmBaseUrl: string;
      pollIntervalMs: number;
      frmToken?: string;
      publicViewerPassword?: string;
      publicViewerPasswordConfirm?: string;
    } = {
      frmBaseUrl,
      pollIntervalMs: poll,
    };
    if (frmToken.trim()) body.frmToken = frmToken.trim();
    if (pubPass.length > 0) {
      body.publicViewerPassword = pubPass;
      body.publicViewerPasswordConfirm = pubPass2;
    }
    save.mutate(body);
  }

  if (isLoading || !s) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <FicsitPageLoader className="min-h-0 flex-1 border-0 bg-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain sm:gap-4">
      <h1 className="sf-display shrink-0 text-lg font-semibold uppercase tracking-[0.12em] text-sf-orange sm:text-xl sm:tracking-[0.15em]">
        {t("settings.title")}
      </h1>
      <form onSubmit={onSubmit} className="sf-panel space-y-4 p-4 sm:p-6">
        {!me?.isAdmin ? <p className="text-sm text-sf-muted">{t("settings.adminOnly")}</p> : null}
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-sf-muted">
            {t("settings.frmUrl")}
          </label>
          <input
            className="sf-input min-h-11 w-full sm:min-h-0"
            value={frmBaseUrl}
            onChange={(e) => setFrmBaseUrl(e.target.value)}
            disabled={!me?.isAdmin}
            placeholder="http://192.168.1.10:8080"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-sf-muted">
            {t("settings.frmToken")}
          </label>
          <input
            className="sf-input min-h-11 w-full sm:min-h-0"
            type="password"
            value={frmToken}
            onChange={(e) => setFrmToken(e.target.value)}
            disabled={!me?.isAdmin}
            placeholder={s.frmTokenConfigured ? "••••••••" : ""}
          />
          <p className="mt-1 text-xs text-sf-muted">{t("settings.tokenHint")}</p>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-sf-muted">
            {t("settings.poll")}
          </label>
          <input
            className="sf-input min-h-11 w-full sm:min-h-0"
            type="number"
            min={2000}
            max={120000}
            step={1000}
            value={poll}
            onChange={(e) => setPoll(Number(e.target.value))}
            disabled={!me?.isAdmin}
          />
        </div>

        <div className="border-t border-sf-border/60 pt-4">
          <h2 className="sf-display text-xs font-semibold uppercase tracking-[0.12em] text-sf-cyan">
            {t("settings.publicViewerSection")}
          </h2>
          <p className="mt-2 text-xs text-sf-muted sm:text-sm">
            {s.publicViewerPasswordConfigured ? t("settings.publicViewerStatusOn") : t("settings.publicViewerStatusOff")}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-sf-muted">
            {t("settings.publicViewerHint", { user: PUBLIC_VIEWER_LOGIN })}
          </p>
          <div className="mt-3 space-y-3">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-sf-cream">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0"
                checked={revokePub}
                onChange={(e) => setRevokePub(e.target.checked)}
                disabled={!me?.isAdmin}
              />
              <span>{t("settings.publicViewerRevoke")}</span>
            </label>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-sf-muted">
                {t("settings.publicViewerPass")}
              </label>
              <input
                className="sf-input min-h-11 w-full sm:min-h-0"
                type="password"
                value={pubPass}
                onChange={(e) => setPubPass(e.target.value)}
                disabled={!me?.isAdmin || revokePub}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-sf-muted">
                {t("settings.publicViewerPassConfirm")}
              </label>
              <input
                className="sf-input min-h-11 w-full sm:min-h-0"
                type="password"
                value={pubPass2}
                onChange={(e) => setPubPass2(e.target.value)}
                disabled={!me?.isAdmin || revokePub}
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>

        {err ? <p className="text-sm text-sf-danger">{err}</p> : null}
        {msg ? <p className="text-sm text-sf-ok">{msg}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="submit"
            className="sf-btn sf-btn-primary min-h-11 w-full sm:min-h-0 sm:w-auto"
            disabled={!me?.isAdmin || save.isPending}
          >
            {t("settings.save")}
          </button>
          <button
            type="button"
            className="sf-btn min-h-11 w-full sm:min-h-0 sm:w-auto"
            onClick={() => test.mutate()}
            disabled={!s.frmTokenConfigured}
          >
            {t("settings.test")}
          </button>
        </div>
        {test.isSuccess ? (
          <pre className="max-h-40 overflow-auto rounded border border-sf-border bg-black/30 p-2 text-xs text-sf-muted">
            {JSON.stringify(test.data, null, 2)}
          </pre>
        ) : null}
        {test.isError ? (
          <p className="text-sm text-sf-danger">{(test.error as Error).message}</p>
        ) : null}
      </form>
    </div>
  );
}
