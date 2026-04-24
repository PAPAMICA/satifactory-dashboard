import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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

function DronesPageBody() {
  const { t } = useTranslation();
  const refetchMs = useFrmRefetchMs();
  const dronesQ = useQuery({
    queryKey: ["frm", "getDrone"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getDrone")),
    refetchInterval: refetchMs,
  });
  const stationsQ = useQuery({
    queryKey: ["frm", "getDroneStation"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getDroneStation")),
    refetchInterval: refetchMs,
  });

  const fleet = asFrmRowArray(dronesQ.data);
  const ports = asFrmRowArray(stationsQ.data);

  const fleetByClass = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of fleet) {
      const c = rowThumbClass(r, "Desc_DroneTransport_C");
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [fleet]);

  const Block = ({
    title,
    rows,
    loading,
    error,
    fallbackThumb,
  }: {
    title: string;
    rows: Record<string, unknown>[];
    loading: boolean;
    error: unknown;
    fallbackThumb: string;
  }) => {
    const errMsg = error instanceof Error ? error.message : error ? String(error) : "";
    return (
      <div className="sf-panel flex min-h-0 min-w-0 flex-1 flex-col  p-3 sm:p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-sf-muted">{title}</h2>
        {errMsg ? (
          <p className="text-sm text-sf-orange">{errMsg}</p>
        ) : loading ? (
          <FicsitPageLoader density="compact" className="min-h-48 border-0 bg-transparent" />
        ) : !rows.length ? (
          <p className="text-sm text-sf-muted">{t("monitoring.empty")}</p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
            {rows.slice(0, 200).map((r, i) => {
              const cls = rowThumbClass(r, fallbackThumb);
              return (
                <li
                  key={String(r.ID ?? r.id ?? i)}
                  className="flex items-center gap-3 rounded border border-sf-border/50 bg-black/20 px-2 py-2"
                >
                  <ItemThumb className={cls} label="" size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-sf-cream">{String(r.Name ?? r.name ?? "—")}</p>
                    <p className="font-mono text-[0.65rem] text-sf-muted">ID {String(r.ID ?? r.id ?? "—")}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <h1 className="sf-display text-lg font-semibold uppercase tracking-[0.12em] text-sf-orange sm:text-xl">
          {t("monitoring.droneTitle")}
        </h1>
        <div className="flex items-center gap-3">
          <ItemThumb className="Desc_DroneTransport_C" label="" size={48} />
          <ItemThumb className="Build_DroneStation_C" label="" size={48} />
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded border border-sf-border/60 bg-black/25 px-3 py-2">
          <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("monitoring.droneFleet")}</p>
          <p className="sf-display mt-1 text-2xl font-semibold text-sf-orange">{formatIntegerSpaces(fleet.length)}</p>
        </div>
        <div className="rounded border border-sf-border/60 bg-black/25 px-3 py-2">
          <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("monitoring.droneStations")}</p>
          <p className="sf-display mt-1 text-2xl font-semibold text-sf-cyan">{formatIntegerSpaces(ports.length)}</p>
        </div>
        <div className="col-span-2 rounded border border-sf-border/60 bg-black/25 px-3 py-2 sm:col-span-2">
          <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("monitoring.droneFleetMix")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {fleetByClass.map(([cls, n]) => (
              <span
                key={cls}
                className="inline-flex items-center gap-1.5 rounded border border-sf-border/50 bg-black/30 px-2 py-1 text-xs text-sf-cream"
              >
                <ItemThumb className={cls} label="" size={24} />
                <span className="font-mono text-sf-orange">×{n}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <Block
          title={t("monitoring.droneFleet")}
          rows={fleet}
          loading={dronesQ.isPending}
          error={dronesQ.error}
          fallbackThumb="Desc_DroneTransport_C"
        />
        <Block
          title={t("monitoring.droneStations")}
          rows={ports}
          loading={stationsQ.isPending}
          error={stationsQ.error}
          fallbackThumb="Build_DroneStation_C"
        />
      </div>
    </div>
  );
}

export function DronesPage() {
  return (
    <MonitoringGate>
      <DronesPageBody />
    </MonitoringGate>
  );
}
