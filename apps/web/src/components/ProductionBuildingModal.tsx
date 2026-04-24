import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FactoryLocationMap } from "@/components/FactoryLocationMap";
import { ItemThumb } from "@/components/ItemThumb";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import { formatDecimalSpaces, formatIntegerSpaces } from "@/lib/formatNumber";
import { itemLabel } from "@/lib/itemCatalog";
import {
  factoryBuildingClassForThumb,
  factoryCircuitGroupId,
  factoryCircuitId,
  factoryHasPowerConnection,
  factoryIngredientLines,
  factoryIsBoosted,
  factoryManuSpeedPct,
  factoryPowerConsumedMw,
  factoryPowerMaxMw,
  factoryPowerShards,
  factoryProductivityPct,
  factoryProductionLines,
  factorySomersloops,
  type ProductionLine,
} from "@/lib/productionFrm";

/** Nom d’affichage catalogue uniquement (pas le nom anglais FRM `Name`). */
function productionItemDisplayName(line: ProductionLine, lang: string): string {
  const c = String(line.ClassName ?? line.className ?? "").trim();
  if (!c) return "—";
  return itemLabel(c, lang) ?? c;
}

export function factoryBuildingPrimarySecondary(
  r: Record<string, unknown>,
  lang: string,
): { primary: string; secondary?: string } {
  const thumbCls = factoryBuildingClassForThumb(r);
  const type = frmgClassLabel(thumbCls, lang);
  const typeEn = frmgClassLabel(thumbCls, "en");
  const typeFr = frmgClassLabel(thumbCls, "fr");
  const inst = String(r.Name ?? r.name ?? "").trim();
  if (!inst) return { primary: type };
  const il = inst.toLowerCase();
  if (il === type.toLowerCase() || il === typeEn.toLowerCase() || il === typeFr.toLowerCase()) {
    return { primary: type };
  }
  return { primary: type, secondary: inst };
}

function chartRowsProd(lines: ProductionLine[], lang: string, maxLabelLen = 22) {
  return lines.map((line) => {
    const full = productionItemDisplayName(line, lang);
    const name = full.length > maxLabelLen ? `${full.slice(0, maxLabelLen - 1)}…` : full;
    return {
      name,
      current: Math.round((Number(line.CurrentProd ?? line.currentProd) || 0) * 100) / 100,
      max: Math.round((Number(line.MaxProd ?? line.maxProd) || 0) * 100) / 100,
    };
  });
}

export function RecipeOutputsList({
  lines,
  lang,
  thumbSize = 32,
  dense,
}: {
  lines: ProductionLine[];
  lang: string;
  thumbSize?: number;
  dense?: boolean;
}) {
  const { t } = useTranslation();
  if (!lines.length) {
    return <p className="text-xs text-sf-muted">{t("monitoring.productionRecipeEmpty")}</p>;
  }
  return (
    <ul className={dense ? "space-y-1" : "space-y-2"}>
      {lines.map((line, i) => {
        const cls = String(line.ClassName ?? line.className ?? "").trim();
        const thumbCls = cls || "Desc_IronPlate_C";
        const nm = productionItemDisplayName(line, lang);
        return (
          <li
            key={`${cls}-${i}`}
            className="flex items-center justify-between gap-2 border-b border-sf-border/25 py-1.5 last:border-b-0"
          >
            <span className={`min-w-0 flex-1 truncate text-sf-cream ${dense ? "text-xs" : "text-sm"}`}>{nm}</span>
            <ItemThumb className={thumbCls} label={nm} size={thumbSize} />
          </li>
        );
      })}
    </ul>
  );
}

export type ProductionBuildingModalProps = {
  row: Record<string, unknown>;
  onClose: () => void;
  /** Colonne carte (modale page Production). Désactiver pour la carte monde. */
  showMap?: boolean;
};

export function ProductionBuildingModal({ row, onClose, showMap = true }: ProductionBuildingModalProps) {
  const { t, i18n } = useTranslation();
  const thumbCls = factoryBuildingClassForThumb(row);
  const { primary, secondary } = factoryBuildingPrimarySecondary(row, i18n.language);
  const mapPopupTitle = secondary ? `${primary} — ${secondary}` : primary;

  const prodLines = factoryProductionLines(row);
  const ingLines = factoryIngredientLines(row);
  const outChart = chartRowsProd(prodLines, i18n.language, showMap ? 22 : 18);
  const inChart = ingLines.map((line) => {
    const full = productionItemDisplayName(line, i18n.language);
    const name = full.length > 22 ? `${full.slice(0, 20)}…` : full;
    return {
      name,
      current: Math.round((Number(line.CurrentConsumed) || 0) * 100) / 100,
      max: Math.round((Number(line.MaxConsumed) || 0) * 100) / 100,
    };
  });

  const manu = factoryManuSpeedPct(row);
  const shards = factoryPowerShards(row);
  const loops = factorySomersloops(row);
  const boosted = factoryIsBoosted(row);
  const g = factoryCircuitGroupId(row);
  const c = factoryCircuitId(row);
  const connected = factoryHasPowerConnection(row);
  const pCur = factoryPowerConsumedMw(row);
  const pMax = factoryPowerMaxMw(row);
  const effPct = factoryProductivityPct(row);

  const isConfigured = Boolean(row.IsConfigured ?? row.isConfigured);
  const isProducing = Boolean(row.IsProducing ?? row.isProducing);
  const isPaused = Boolean(row.IsPaused ?? row.isPaused);

  const chartH = showMap ? 200 : 140;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { x, y, z } = (() => {
    const l = (row.location ?? row.Location) as Record<string, unknown> | undefined;
    return {
      x: l?.x ?? l?.X ?? row.x,
      y: l?.y ?? l?.Y ?? row.y,
      z: l?.z ?? l?.Z ?? row.z,
    };
  })();

  const bodyPanel = (
    <div
      className={`flex min-h-0 w-full flex-col gap-3 overflow-y-auto p-4 sm:p-5 ${showMap ? "lg:w-[58%] lg:shrink-0 lg:border-r lg:border-sf-border/40 lg:pr-5" : "max-w-xl flex-1"}`}
    >
      <div className="rounded-lg border border-sf-border/70 bg-black/25 p-3 ring-1 ring-white/[0.04] sm:p-4">
        <p className="text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
          {t("monitoring.productionRecipeItems")}
        </p>
        <div className="mt-2 max-h-[min(28vh,220px)] overflow-y-auto pr-1 sm:max-h-[min(32vh,280px)]">
          <RecipeOutputsList lines={prodLines} lang={i18n.language} thumbSize={showMap ? 36 : 32} />
        </div>
      </div>

      {!showMap ?
        <div className="rounded-lg border border-sf-border/60 bg-black/20 px-3 py-2 font-mono text-[0.65rem] text-sf-muted">
          {Number.isFinite(Number(x)) ? Math.round(Number(x)) : "—"},{" "}
          {Number.isFinite(Number(y)) ? Math.round(Number(y)) : "—"},{" "}
          {Number.isFinite(Number(z)) ? Math.round(Number(z)) : "—"}
        </div>
      : null}

      <div className={`grid gap-3 ${showMap ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <div className="rounded-lg border border-sf-border/70 bg-black/25 p-3 ring-1 ring-white/[0.04] sm:p-3.5">
          <p className="text-[0.6rem] font-medium uppercase tracking-wider text-sf-muted">
            {t("monitoring.productionCardState")}
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-sf-cream sm:text-sm">
            <li>
              {t("monitoring.productionConfigured")}:{" "}
              <span className={isConfigured ? "text-sf-ok" : "text-sf-muted"}>
                {isConfigured ? t("common.yes") : t("common.no")}
              </span>
            </li>
            <li>
              {t("monitoring.productionProducing")}:{" "}
              <span className={isProducing ? "text-sf-ok" : "text-sf-muted"}>
                {isProducing ? t("common.yes") : t("common.no")}
              </span>
            </li>
            <li>
              {t("monitoring.productionPaused")}:{" "}
              <span className={isPaused ? "text-sf-orange" : "text-sf-muted"}>
                {isPaused ? t("common.yes") : t("common.no")}
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-sf-border/70 bg-black/25 p-3 ring-1 ring-white/[0.04] sm:p-3.5">
          <p className="text-[0.6rem] font-medium uppercase tracking-wider text-sf-muted">
            {t("monitoring.productionCardBoost")}
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-sf-cream sm:text-sm">
            <li>
              {t("monitoring.productionSpeed", { n: formatDecimalSpaces(manu, 1) })}
              {boosted ? <span className="ml-1 text-sf-orange">({t("monitoring.productionBoost")})</span> : null}
            </li>
            <li>
              {t("monitoring.productionPowerShards")}:{" "}
              <span className="font-mono text-sf-cyan">{formatIntegerSpaces(shards)}</span>
            </li>
            <li>
              {t("monitoring.productionSomersloops")}:{" "}
              <span className="font-mono text-sf-cyan">{formatIntegerSpaces(loops)}</span>
            </li>
          </ul>
        </div>

        <div
          className={`rounded-lg border border-sf-border/70 bg-black/25 p-3 ring-1 ring-white/[0.04] sm:p-3.5 ${showMap ? "" : "sm:col-span-2"}`}
        >
          <p className="text-[0.6rem] font-medium uppercase tracking-wider text-sf-muted">
            {t("monitoring.productionCardPower")}
          </p>
          <p className="mt-1.5 text-xs text-sf-cream sm:text-sm">
            {connected && g != null && c != null ?
              t("monitoring.productionConnect", { g, c })
            : t("monitoring.productionNotConnected")}
          </p>
          <p className="mt-1 font-mono text-sm text-sf-orange sm:text-base">
            {formatDecimalSpaces(pCur, 2)} / {formatDecimalSpaces(pMax, 2)} MW
          </p>
        </div>
      </div>

      {outChart.length || inChart.length ?
        <div className={`grid min-h-0 flex-1 gap-3 ${showMap ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          {outChart.length ?
            <div className="flex min-h-0 flex-col rounded-lg border border-sf-border/70 bg-black/20 p-3">
              <p className="mb-1 shrink-0 text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
                {t("monitoring.productionChartOutputs")}
              </p>
              <div className="min-h-0 w-full flex-1" style={{ height: chartH, minHeight: chartH }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={outChart} layout="vertical" margin={{ left: 4, right: 4, top: 2, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3d3528" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#8a7f6e", fontSize: 9 }} />
                    <YAxis type="category" dataKey="name" width={showMap ? 100 : 88} tick={{ fill: "#8a7f6e", fontSize: 8 }} />
                    <Tooltip
                      contentStyle={{ background: "#1a1814", border: "1px solid #3d3528", borderRadius: 4 }}
                      formatter={(v: number, name: string) => [
                        v,
                        name === "current" ? t("monitoring.productionChartCurrent") : t("monitoring.productionChartMax"),
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 10 }}
                      formatter={(v) =>
                        v === "current" ? t("monitoring.productionChartCurrent") : t("monitoring.productionChartMax")
                      }
                    />
                    <Bar dataKey="current" name="current" fill="#7cfc8a" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="max" name="max" fill="#4a4336" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          : null}
          {inChart.length ?
            <div className="flex min-h-0 flex-col rounded-lg border border-sf-border/70 bg-black/20 p-3">
              <p className="mb-1 shrink-0 text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
                {t("monitoring.productionChartInputs")}
              </p>
              <div className="min-h-0 w-full flex-1" style={{ height: chartH, minHeight: chartH }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inChart} layout="vertical" margin={{ left: 4, right: 4, top: 2, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3d3528" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#8a7f6e", fontSize: 9 }} />
                    <YAxis type="category" dataKey="name" width={showMap ? 100 : 88} tick={{ fill: "#8a7f6e", fontSize: 8 }} />
                    <Tooltip
                      contentStyle={{ background: "#1a1814", border: "1px solid #3d3528", borderRadius: 4 }}
                      formatter={(v: number, name: string) => [
                        v,
                        name === "current" ? t("monitoring.productionChartCurrent") : t("monitoring.productionChartMax"),
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 10 }}
                      formatter={(v) =>
                        v === "current" ? t("monitoring.productionChartCurrent") : t("monitoring.productionChartMax")
                      }
                    />
                    <Bar dataKey="current" name="current" fill="#5fd4ff" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="max" name="max" fill="#4a4336" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          : null}
        </div>
      : null}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/80 p-0 sm:p-2"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="production-building-modal-title"
        className={
          showMap ?
            `flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0 border-sf-border/80 bg-[#14120f] shadow-2xl ring-1 ring-black/40 sm:mx-auto sm:h-[min(calc(100dvh-16px),920px)] sm:max-h-[min(calc(100dvh-16px),920px)] sm:w-[min(100%,calc(100vw-16px))] sm:max-w-[min(1600px,calc(100vw-16px))] sm:rounded-xl sm:border`
          : `mx-auto flex max-h-[min(calc(100dvh-24px),640px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-sf-border/80 bg-[#14120f] shadow-2xl ring-1 ring-black/40 sm:my-auto`
        }
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-sf-border/60 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <ItemThumb className={thumbCls} label={primary} size={showMap ? 44 : 36} />
            <div className="min-w-0">
              <h2
                id="production-building-modal-title"
                className={`sf-display font-semibold text-sf-cream ${showMap ? "text-base sm:text-lg" : "text-sm sm:text-base"}`}
              >
                {primary}
              </h2>
              {secondary ?
                <p className="mt-0.5 truncate text-xs text-sf-muted">{secondary}</p>
              : null}
              <p className="mt-1 font-mono text-[0.65rem] text-sf-muted">
                {t("monitoring.productionFilterEfficiency")}: {formatDecimalSpaces(effPct, 1)}%
              </p>
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded border border-sf-border/60 px-2.5 py-1 text-xs text-sf-muted hover:border-sf-orange/50 hover:text-sf-orange"
            onClick={onClose}
          >
            {t("monitoring.productionClose")}
          </button>
        </div>

        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${showMap ? "lg:flex-row lg:items-stretch" : ""}`}
        >
          {bodyPanel}
          {showMap ?
            <div className="flex w-full shrink-0 flex-col border-t border-sf-border/50 bg-black/10 p-4 sm:p-5 lg:h-full lg:min-h-0 lg:w-[42%] lg:min-w-0 lg:max-w-[42%] lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-5">
              <p className="text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted lg:sr-only">
                {t("monitoring.productionModalMap")}
              </p>
              <div className="flex min-h-[min(280px,55vw)] flex-1 items-center justify-center lg:min-h-0">
                <div className="aspect-square w-full max-w-full max-h-full min-h-0 overflow-hidden rounded-lg border border-sf-border/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
                  <FactoryLocationMap row={row} title={mapPopupTitle} fillParent className="h-full min-h-0 w-full rounded-lg border-0" />
                </div>
              </div>
            </div>
          : null}
        </div>
      </div>
    </div>
  );
}
