import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ItemThumb } from "@/components/ItemThumb";
import { LinearFractionBar } from "@/components/LinearFractionBar";
import { MonitoringGate } from "@/components/MonitoringGate";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";
import { formatIntegerSpaces } from "@/lib/formatNumber";

function pctNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) / 100 : 0;
}

function SinkSection({
  title,
  rows,
  thumbClass,
}: {
  title: string;
  rows: Record<string, unknown>[];
  thumbClass: string;
}) {
  const { t } = useTranslation();
  if (!rows.length) {
    return (
      <div className="sf-panel p-4">
        <div className="mb-3 flex items-center gap-2">
          <ItemThumb className={thumbClass} label="" size={40} />
          <h2 className="text-xs font-medium uppercase tracking-wider text-sf-muted">{title}</h2>
        </div>
        <p className="text-sm text-sf-muted">{t("monitoring.empty")}</p>
      </div>
    );
  }
  const coupons = rows.reduce((a, r) => a + (Number(r.NumCoupon) || 0), 0);
  const avgPct =
    rows.length > 0 ? rows.reduce((a, r) => a + (Number(r.Percent) || 0), 0) / rows.length : 0;

  return (
    <div className="sf-panel p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <ItemThumb className={thumbClass} label="" size={44} />
          <h2 className="text-xs font-medium uppercase tracking-wider text-sf-muted">{title}</h2>
        </div>
        <div className="flex gap-4 text-xs">
          <div>
            <span className="text-sf-muted">{t("monitoring.sinkSectionSinks")} </span>
            <span className="font-mono text-sf-cream">{formatIntegerSpaces(rows.length)}</span>
          </div>
          <div>
            <span className="text-sf-muted">{t("monitoring.sinkSectionCoupons")} </span>
            <span className="font-mono text-sf-ok">{formatIntegerSpaces(coupons)}</span>
          </div>
          <div>
            <span className="text-sf-muted">{t("monitoring.sinkSectionAvgPct")} </span>
            <span className="font-mono text-sf-orange">{Math.round(avgPct * 10) / 10}%</span>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r, i) => {
          const frac = pctNum(r.Percent);
          return (
            <div key={String(r.Name ?? i)} className="rounded border border-sf-border/60 bg-black/25 p-3">
              <div className="flex items-start gap-2">
                <ItemThumb className={thumbClass} label="" size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sf-cream">{String(r.Name ?? "—")}</p>
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-sf-muted">{t("monitoring.sinkPercent")}</span>
                      <span className="font-mono text-sf-orange">{String(r.Percent ?? "—")}</span>
                    </div>
                    <LinearFractionBar fraction={frac} />
                    <dl className="grid grid-cols-2 gap-1">
                      <dt className="text-sf-muted">{t("monitoring.sinkCoupons")}</dt>
                      <dd className="font-mono text-sf-ok">{String(r.NumCoupon ?? "—")}</dd>
                      <dt className="text-sf-muted">{t("monitoring.sinkTotalPoints")}</dt>
                      <dd className="font-mono text-sf-cyan">{String(r.TotalPoints ?? "—")}</dd>
                      <dt className="text-sf-muted">{t("monitoring.sinkNextCoupon")}</dt>
                      <dd className="font-mono text-sf-muted">{String(r.PointsToCoupon ?? "—")}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResourceSinkPageBody() {
  const { t } = useTranslation();
  const refetchMs = useFrmRefetchMs();
  const resQ = useQuery({
    queryKey: ["frm", "getResourceSink"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getResourceSink")),
    refetchInterval: refetchMs,
  });
  const expQ = useQuery({
    queryKey: ["frm", "getExplorationSink"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getExplorationSink")),
    refetchInterval: refetchMs,
  });

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <h1 className="sf-display text-lg font-semibold uppercase tracking-[0.12em] text-sf-orange sm:text-xl">
          {t("monitoring.sinkTitle")}
        </h1>
        <div className="flex items-center gap-2">
          <ItemThumb className="Build_ResourceSink_C" label="" size={44} />
          <ItemThumb className="Build_ResourceSinkShop_C" label="" size={44} />
        </div>
      </div>
      {resQ.isError ? <p className="text-sm text-sf-orange">{(resQ.error as Error).message}</p> : null}
      {expQ.isError ? <p className="text-sm text-sf-orange">{(expQ.error as Error).message}</p> : null}
      <SinkSection title={t("monitoring.sinkResource")} rows={asFrmRowArray(resQ.data)} thumbClass="Build_ResourceSink_C" />
      <SinkSection
        title={t("monitoring.sinkExploration")}
        rows={asFrmRowArray(expQ.data)}
        thumbClass="Build_ResourceSinkShop_C"
      />
    </div>
  );
}

export function ResourceSinkPage() {
  return (
    <MonitoringGate>
      <ResourceSinkPageBody />
    </MonitoringGate>
  );
}
