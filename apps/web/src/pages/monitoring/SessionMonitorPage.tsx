import { Fragment, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FicsitPageLoader } from "@/components/FicsitPageLoader";
import { ItemThumb } from "@/components/ItemThumb";
import { MonitoringGate } from "@/components/MonitoringGate";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";
import { formatIntegerSpaces } from "@/lib/formatNumber";
import { rowThumbClass } from "@/lib/monitoringFrm";

const SESSION_HIGHLIGHT_KEYS = [
  "SessionName",
  "PassedDays",
  "NumberOfPlayers",
  "NumberOfDaysSinceLastDeath",
  "IsPaused",
  "ActiveSchematic",
] as const;

function SessionMonitorPageBody() {
  const { t } = useTranslation();
  const refetchMs = useFrmRefetchMs();
  const sessionQ = useQuery({
    queryKey: ["frm", "getSessionInfo"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getSessionInfo")),
    refetchInterval: refetchMs,
  });
  const playersQ = useQuery({
    queryKey: ["frm", "getPlayer"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getPlayer")),
    refetchInterval: refetchMs,
  });

  const session = sessionQ.data;
  const players = asFrmRowArray(playersQ.data);

  const sessionObj = useMemo(() => {
    if (session && typeof session === "object" && !Array.isArray(session)) {
      return session as Record<string, unknown>;
    }
    if (Array.isArray(session) && session[0] && typeof session[0] === "object") {
      return session[0] as Record<string, unknown>;
    }
    return null;
  }, [session]);

  const highlights = useMemo(() => {
    if (!sessionObj) return [];
    return SESSION_HIGHLIGHT_KEYS.filter((k) => k in sessionObj).map((k) => ({
      key: k,
      value: sessionObj[k],
    }));
  }, [sessionObj]);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="sf-display text-lg font-semibold uppercase tracking-[0.12em] text-sf-orange sm:text-xl">
          {t("monitoring.sessionTitle")}
        </h1>
        <div className="flex items-center gap-2">
          <ItemThumb className="Build_TradingPost_C" label="" size={44} />
          <ItemThumb className="Build_StoragePlayer_C" label="" size={44} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded border border-sf-border/60 bg-black/25 px-3 py-2">
          <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("monitoring.sessionPlayers")}</p>
          <p className="sf-display mt-1 text-2xl font-semibold text-sf-cyan">{formatIntegerSpaces(players.length)}</p>
        </div>
        {highlights.slice(0, 3).map(({ key, value }) => (
          <div key={key} className="rounded border border-sf-border/60 bg-black/25 px-3 py-2">
            <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{key}</p>
            <p className="sf-display mt-1 truncate text-lg font-semibold text-sf-cream sm:text-xl">
              {typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}
            </p>
          </div>
        ))}
      </div>

      <div className="sf-panel p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-sf-muted">
          {t("monitoring.sessionInfo")}
        </h2>
        {sessionQ.isError ? (
          <p className="text-sm text-sf-orange">{(sessionQ.error as Error).message}</p>
        ) : sessionQ.isPending ? (
          <FicsitPageLoader density="compact" className="min-h-48 border-0 bg-transparent" />
        ) : sessionObj ? (
          <dl className="grid w-full min-w-0 grid-cols-[minmax(0,auto)_1fr] gap-x-4 gap-y-2 text-sm">
            {Object.entries(sessionObj).map(([k, v]) => (
              <Fragment key={k}>
                <dt className="font-mono text-sf-muted">{k}</dt>
                <dd className="break-words text-sf-cream">
                  {typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "—")}
                </dd>
              </Fragment>
            ))}
          </dl>
        ) : (
          <pre className="overflow-auto text-xs text-sf-muted">{JSON.stringify(session, null, 2)}</pre>
        )}
      </div>

      <div className="sf-panel min-w-0 overflow-hidden p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-sf-muted">
          {t("monitoring.sessionPlayers")} ({players.length})
        </h2>
        {playersQ.isError ? (
          <p className="text-sm text-sf-orange">{(playersQ.error as Error).message}</p>
        ) : playersQ.isPending ? (
          <FicsitPageLoader density="compact" className="min-h-48 border-0 bg-transparent" />
        ) : !players.length ? (
          <p className="text-sm text-sf-muted">{t("monitoring.empty")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((p, i) => {
              const cls = rowThumbClass(p, "Build_StoragePlayer_C");
              const idStr =
                p.ID != null && Number.isFinite(Number(p.ID)) ?
                  formatIntegerSpaces(Number(p.ID))
                : String(p.ID ?? "—");
              return (
                <div
                  key={String(p.ID ?? p.PlayerName ?? i)}
                  className="flex items-center gap-3 rounded border border-sf-border/50 bg-black/20 p-3"
                >
                  <ItemThumb className={cls} label="" size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-sf-cream">
                      {String(p.PlayerName ?? p.Name ?? "—")}
                    </p>
                    <p className="mt-1 font-mono text-xs text-sf-muted">ID {idStr}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function SessionMonitorPage() {
  return (
    <MonitoringGate>
      <SessionMonitorPageBody />
    </MonitoringGate>
  );
}
