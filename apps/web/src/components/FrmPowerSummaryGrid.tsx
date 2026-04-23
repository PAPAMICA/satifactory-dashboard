import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDecimalSpaces, formatIntegerSpaces } from "@/lib/formatNumber";
import { circuitFuseCount, sumCircuitField } from "@/lib/monitoringFrm";

function fmtMw(n: number): string {
  const v = Math.round(n * 10) / 10;
  return `${formatDecimalSpaces(v, 1)} MW`;
}

export type FrmPowerSummaryVariant = "standard" | "visual";

/**
 * Grille de résumé énergie (même contenu que le widget « power » du tableau de bord).
 */
export function FrmPowerSummaryGrid({
  circuits,
  variant = "visual",
}: {
  circuits: Record<string, unknown>[];
  variant?: FrmPowerSummaryVariant;
}) {
  const { t } = useTranslation();
  const produced = sumCircuitField(circuits, "PowerProduction");
  const consumed = sumCircuitField(circuits, "PowerConsumed");
  const capacity = sumCircuitField(circuits, "PowerCapacity");
  const fuses = circuitFuseCount(circuits);
  const batteryAvg =
    circuits.length ?
      Math.round(
        (circuits.reduce((a, p) => a + (Number(p.BatteryPercent) || 0), 0) / circuits.length) * 10,
      ) / 10
    : 0;

  const powerStrip = useMemo(() => {
    if (!circuits.length) return null;
    /** Charge = consommation / production (réseau global), en %. */
    const loadPct = produced > 0 ? Math.round((consumed / produced) * 1000) / 10 : null;
    return {
      loadPct,
      balanceMw: Math.round((produced - consumed) * 10) / 10,
      circuits: circuits.length,
    };
  }, [circuits, produced, consumed]);

  const loadValueClass =
    powerStrip?.loadPct == null ? "text-sf-cream"
    : powerStrip.loadPct > 90 ? "text-sf-danger"
    : powerStrip.loadPct < 60 ? "text-sf-ok"
    : "text-sf-orange";

  const loadStr =
    powerStrip?.loadPct != null ? `${formatDecimalSpaces(powerStrip.loadPct, 1)}%` : "—";
  const balanceStr = powerStrip ? fmtMw(powerStrip.balanceMw) : "—";
  const circuitsStr = powerStrip ? formatIntegerSpaces(powerStrip.circuits) : "—";
  const fusesStr = formatIntegerSpaces(fuses);
  const batteryStr = circuits.length ? `${formatDecimalSpaces(batteryAvg, 1)}%` : "—";
  const valClass =
    variant === "visual" ? "sf-display text-2xl font-semibold sm:text-3xl" : "sf-display text-lg font-semibold sm:text-xl";
  const cardPad = variant === "visual" ? "p-3 sm:p-4" : "p-2 sm:p-3";
  const cardMin = variant === "visual" ? "min-h-[5.5rem]" : "min-h-0";
  const labelClass =
    variant === "visual" ?
      "text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted"
    : "text-[0.55rem] font-medium uppercase leading-tight tracking-wider text-sf-muted";
  const card = (
    label: string,
    value: string,
    opts: { hint?: string; valueClass?: string },
  ) => (
    <div
      title={opts.hint}
      className={`flex ${cardMin} flex-col justify-between gap-0.5 rounded-lg border border-sf-border/80 bg-black/25 shadow-sm ring-1 ring-white/[0.04] ${cardPad}`}
    >
      <p className={labelClass}>{label}</p>
      <p className={`${valClass} font-mono tabular-nums leading-none ${opts.valueClass ?? "text-sf-cream"}`}>{value}</p>
    </div>
  );
  const gridClass =
    variant === "visual" ?
      "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
    : "grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2";

  return (
    <div
      className={
        "box-border flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-auto " +
        (variant === "visual" ? "p-3 sm:p-4" : "p-2 sm:p-3")
      }
    >
      <div className={gridClass}>
        {card(t("dashboard.production"), fmtMw(produced), { valueClass: "text-sf-orange" })}
        {card(t("dashboard.consumption"), fmtMw(consumed), { valueClass: "text-sf-cyan" })}
        {card(t("dashboard.capacity"), fmtMw(capacity), { valueClass: "text-sf-muted" })}
        {card(t("dashboard.battery"), batteryStr, {
          hint: t("dashboard.powerBatteryHint"),
          valueClass: "text-sf-ok",
        })}
        {card(t("dashboard.powerLoad"), loadStr, {
          hint: t("dashboard.powerLoadHint"),
          valueClass: loadValueClass,
        })}
        {card(t("dashboard.powerBalance"), balanceStr, {
          hint: t("dashboard.powerBalanceHint"),
          valueClass:
            powerStrip && powerStrip.balanceMw >= 0 ? "text-sf-ok" : powerStrip ? "text-sf-danger" : "text-sf-cream",
        })}
        {card(t("dashboard.powerCircuits"), circuitsStr, {
          hint: t("dashboard.powerCircuitsHint"),
          valueClass: "text-sf-cyan",
        })}
        {card(t("dashboard.fuses"), fusesStr, {
          valueClass: fuses > 0 ? "text-sf-danger" : "text-sf-muted",
        })}
      </div>
    </div>
  );
}
