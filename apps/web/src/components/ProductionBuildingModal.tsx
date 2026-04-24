import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FactoryLocationMap } from "@/components/FactoryLocationMap";
import { FrmBuildingPowerToggle } from "@/components/FrmBuildingPowerToggle";
import { ItemThumb } from "@/components/ItemThumb";
import { useGeneratorSnapshotHistory } from "@/hooks/useGeneratorSnapshotHistory";
import { usePowerUsageMwByClassHistory } from "@/hooks/usePowerUsageMwByClassHistory";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import { normalizeFrmBuildingClassName } from "@/lib/frmFactoryMapCategory";
import { frmGetUrl } from "@/lib/frmApi";
import { formatDecimalSpaces, formatIntegerSpaces } from "@/lib/formatNumber";
import { generatorMwLive, normalizeBuildClassName } from "@/lib/monitoringFrm";
import { formatChartAxisTime, type PowerHistoryApiPoint } from "@/lib/powerHistoryChart";
import { itemLabel } from "@/lib/itemCatalog";
import { apiFetch } from "@/lib/api";
import { asFrmRowArray } from "@/lib/frmRows";
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

type Settings = { frmTokenConfigured?: boolean; pollIntervalMs?: number };

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

function isGeneratorFrmRow(r: Record<string, unknown>): boolean {
  const cn = normalizeFrmBuildingClassName(String(r.ClassName ?? r.className ?? ""));
  if (/Build_Generator/i.test(cn)) return true;
  return (
    r.RegulatedDemandProd !== undefined ||
    r.regulatedDemandProd !== undefined ||
    r.DynamicProdCapacity !== undefined ||
    r.dynamicProdCapacity !== undefined
  );
}

function ProductionRateTextBlock({
  titleKey,
  lines,
  lang,
  mode,
}: {
  titleKey: string;
  lines: ProductionLine[];
  lang: string;
  mode: "out" | "in";
}) {
  const { t } = useTranslation();
  if (!lines.length) return null;
  return (
    <div className="rounded-lg border border-sf-border/70 bg-black/25 p-3 ring-1 ring-white/[0.04]">
      <p className="text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">{t(titleKey)}</p>
      <ul className="mt-2 space-y-1 text-xs text-sf-cream">
        {lines.map((line, i) => {
          const label = productionItemDisplayName(line, lang);
          const cur =
            mode === "out" ?
              Number(line.CurrentProd ?? line.currentProd) || 0
            : Number(line.CurrentConsumed ?? line.currentConsumed) || 0;
          const max =
            mode === "out" ?
              Number(line.MaxProd ?? line.maxProd) || 0
            : Number(line.MaxConsumed ?? line.maxConsumed) || 0;
          return (
            <li
              key={`${String(line.ClassName)}-${i}`}
              className="flex flex-wrap items-baseline justify-between gap-x-2 border-b border-sf-border/15 py-1.5 last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <span className="shrink-0 font-mono text-[0.72rem] text-sf-orange tabular-nums">
                {formatDecimalSpaces(cur, 2)} / {formatDecimalSpaces(max, 2)}{" "}
                <span className="text-[0.6rem] font-normal text-sf-muted">{t("monitoring.buildingModalCeilingShort")}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PowerGridDualLineChart({
  points,
  height,
}: {
  points: { t: string; production: number; consumption: number }[];
  height: number;
}) {
  const { t } = useTranslation();
  if (points.length < 2) {
    return <p className="text-xs text-sf-muted">{t("monitoring.buildingModalTrendNeedSamples")}</p>;
  }
  return (
    <div style={{ height, minHeight: height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3d3528" />
          <XAxis dataKey="t" tick={{ fill: "#8a7f6e", fontSize: 9 }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis
            width={36}
            tick={{ fill: "#8a7f6e", fontSize: 9 }}
            tickFormatter={(v) => `${formatDecimalSpaces(Number(v), 0)}`}
          />
          <Tooltip
            contentStyle={{ background: "#1a1814", border: "1px solid #3d3528", borderRadius: 4, fontSize: 11 }}
            formatter={(v: number, name: string) => [formatDecimalSpaces(v, 2), name]}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="production" name={t("monitoring.buildingModalLegendProdMw")} stroke="#7cfc8a" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Line type="monotone" dataKey="consumption" name={t("monitoring.buildingModalLegendConsMw")} stroke="#5fd4ff" dot={false} strokeWidth={1.5} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ClassMwLineChart({ values, height }: { values: number[]; height: number }) {
  const { t } = useTranslation();
  const data = useMemo(() => values.map((mw, i) => ({ i, mw })), [values]);
  if (data.length < 2) {
    return <p className="text-xs text-sf-muted">{t("monitoring.buildingModalTrendNeedSamples")}</p>;
  }
  return (
    <div style={{ height, minHeight: height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3d3528" />
          <XAxis dataKey="i" hide />
          <YAxis
            width={36}
            tick={{ fill: "#8a7f6e", fontSize: 9 }}
            tickFormatter={(v) => `${formatDecimalSpaces(Number(v), 0)}`}
          />
          <Tooltip
            contentStyle={{ background: "#1a1814", border: "1px solid #3d3528", borderRadius: 4, fontSize: 11 }}
            formatter={(v: number) => [`${formatDecimalSpaces(v, 2)} MW`, t("monitoring.buildingModalClassMwTitle")]}
          />
          <Line type="monotone" dataKey="mw" name="MW" stroke="#f59e0b" dot={false} strokeWidth={1.5} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function GeneratorMwSupLineChart({
  chartData,
  height,
}: {
  chartData: { i: number; mw: number; sup: number }[];
  height: number;
}) {
  const { t } = useTranslation();
  if (chartData.length < 2) {
    return <p className="text-xs text-sf-muted">{t("monitoring.buildingModalTrendNeedSamples")}</p>;
  }
  return (
    <div style={{ height, minHeight: height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3d3528" />
          <XAxis dataKey="i" hide />
          <YAxis yAxisId="l" width={40} tick={{ fill: "#8a7f6e", fontSize: 9 }} />
          <YAxis yAxisId="r" orientation="right" width={40} tick={{ fill: "#8a7f6e", fontSize: 9 }} />
          <Tooltip contentStyle={{ background: "#1a1814", border: "1px solid #3d3528", borderRadius: 4, fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line
            yAxisId="l"
            type="monotone"
            dataKey="mw"
            name={t("monitoring.generatorMwLive")}
            stroke="#7cfc8a"
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
          <Line
            yAxisId="r"
            type="monotone"
            dataKey="sup"
            name={t("monitoring.generatorSupplementCurve")}
            stroke="#5fd4ff"
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
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
  /** Afficher le bloc contrôle alimentation (vérifié côté client avec le profil admin). */
  showAdminControls?: boolean;
};

const CHART_H = 132;

export function ProductionBuildingModal({ row, onClose, showMap = true, showAdminControls = false }: ProductionBuildingModalProps) {
  const { t, i18n } = useTranslation();
  const thumbCls = factoryBuildingClassForThumb(row);
  const { primary, secondary } = factoryBuildingPrimarySecondary(row, i18n.language);
  const mapPopupTitle = secondary ? `${primary} — ${secondary}` : primary;
  const buildingId = String(row.ID ?? row.Id ?? "").trim();

  const prodLines = factoryProductionLines(row);
  const ingLines = factoryIngredientLines(row);
  const isGenerator = isGeneratorFrmRow(row);
  const classNorm = normalizeBuildClassName(String(row.ClassName ?? row.className ?? ""));

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<Settings>("/api/settings"),
    staleTime: 5_000,
  });
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ isPublicViewer?: boolean; isAdmin?: boolean }>("/api/me"),
    staleTime: 60_000,
  });
  const isPublic = Boolean(me?.isPublicViewer);
  const adminPowerToggle =
    Boolean(showAdminControls && me?.isAdmin && !isPublic && buildingId);
  const frmOk = Boolean(settings?.frmTokenConfigured);
  const interval = settings?.pollIntervalMs ?? 10_000;

  const usageQ = useQuery({
    queryKey: ["frm", "getPowerUsage"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getPowerUsage")),
    refetchInterval: interval,
    refetchIntervalInBackground: true,
    staleTime: 0,
    enabled: frmOk && !isPublic && !isGenerator,
  });
  const usageRows = asFrmRowArray(usageQ.data);
  const { getSeries } = usePowerUsageMwByClassHistory(usageRows, usageQ.dataUpdatedAt, frmOk && !isPublic && !isGenerator);
  const classMwSeries = useMemo(() => getSeries(classNorm), [getSeries, classNorm]);

  const windowMin = 60;
  const powerHistQ = useQuery({
    queryKey: ["metrics", "power", "history", windowMin, 200],
    queryFn: () =>
      apiFetch<{ points: PowerHistoryApiPoint[] }>(
        `/api/metrics/power/history?minutes=${windowMin}&maxPoints=200`,
      ),
    enabled: frmOk && !isPublic,
    staleTime: 60_000,
  });
  const gridChartPoints = useMemo(() => {
    const pts = powerHistQ.data?.points ?? [];
    const lang = i18n.language;
    return pts.map((p) => ({
      tsMs: p.tsMs,
      t: formatChartAxisTime(p.tsMs, windowMin, lang),
      production: Math.round(p.production * 10) / 10,
      consumption: Math.round(p.consumption * 10) / 10,
    }));
  }, [powerHistQ.data, i18n.language]);

  const genListQ = useQuery({
    queryKey: ["frm", "getGenerators"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getGenerators")),
    refetchInterval: interval,
    refetchIntervalInBackground: true,
    staleTime: 0,
    enabled: frmOk && isGenerator,
  });
  const genRows = asFrmRowArray(genListQ.data);
  const { chartData: genChartData } = useGeneratorSnapshotHistory(
    isGenerator,
    genListQ.dataUpdatedAt,
    row,
    genRows,
  );

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

  const supplement = (row.Supplement ?? row.supplement) as Record<string, unknown> | undefined;
  const supName = supplement ? String(supplement.Name ?? supplement.name ?? "") : "";
  const supCur = supplement ? Number(supplement.CurrentConsumed ?? supplement.currentConsumed) || 0 : 0;
  const supMax = supplement ? Number(supplement.MaxConsumed ?? supplement.maxConsumed) || 0 : 0;
  const fuelAmt = Number(row.FuelAmount ?? row.fuelAmount) || 0;

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
      {adminPowerToggle ?
        <FrmBuildingPowerToggle buildingId={buildingId} title={primary} subtitle={secondary} compact={!showMap} />
      : null}

      {isGenerator ?
        <div className="rounded-lg border border-sf-border/70 bg-black/25 p-3 ring-1 ring-white/[0.04] sm:p-4">
          <p className="text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
            {t("monitoring.generatorDetailTitle")}
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-sf-cream">
            <li>
              <span className="text-sf-muted">{t("monitoring.generatorMwLive")}: </span>
              <span className="font-mono text-sf-orange">{formatDecimalSpaces(generatorMwLive(row), 2)} MW</span>
            </li>
            <li>
              <span className="text-sf-muted">{t("monitoring.generatorFuel")}: </span>
              <span className="font-mono">{formatDecimalSpaces(fuelAmt, 3)}</span>
            </li>
            {supplement ?
              <li>
                <span className="text-sf-muted">{t("monitoring.generatorSupplement")}: </span>
                <span className="font-mono">
                  {supName ? `${supName} — ` : null}
                  {formatDecimalSpaces(supCur, 2)} / {formatDecimalSpaces(supMax, 2)}{" "}
                  <span className="text-sf-muted">{t("monitoring.buildingModalCeilingShort")}</span>
                </span>
              </li>
            : null}
          </ul>
        </div>
      : (
        <div className="rounded-lg border border-sf-border/70 bg-black/25 p-3 ring-1 ring-white/[0.04] sm:p-4">
          <p className="text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
            {t("monitoring.productionRecipeItems")}
          </p>
          <div className="mt-2 max-h-[min(28vh,220px)] overflow-y-auto pr-1 sm:max-h-[min(32vh,280px)]">
            <RecipeOutputsList lines={prodLines} lang={i18n.language} thumbSize={showMap ? 36 : 32} />
          </div>
        </div>
      )}

      {!isGenerator ?
        <>
          <ProductionRateTextBlock titleKey="monitoring.productionChartOutputs" lines={prodLines} lang={i18n.language} mode="out" />
          <ProductionRateTextBlock titleKey="monitoring.productionChartInputs" lines={ingLines} lang={i18n.language} mode="in" />
        </>
      : null}

      {!showMap ?
        <div className="rounded-lg border border-sf-border/60 bg-black/20 px-3 py-2 font-mono text-[0.65rem] text-sf-muted">
          {Number.isFinite(Number(x)) ? Math.round(Number(x)) : "—"},{" "}
          {Number.isFinite(Number(y)) ? Math.round(Number(y)) : "—"},{" "}
          {Number.isFinite(Number(z)) ? Math.round(Number(z)) : "—"}
        </div>
      : null}

      {frmOk && !isPublic ?
        <div className="rounded-lg border border-sf-border/70 bg-black/20 p-3">
          <p className="text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
            {t("monitoring.buildingModalGridPowerTitle")}
          </p>
          <div className="mt-2">
            <PowerGridDualLineChart points={gridChartPoints} height={CHART_H} />
          </div>
        </div>
      : null}

      {frmOk && !isPublic && !isGenerator ?
        <div className="rounded-lg border border-sf-border/70 bg-black/20 p-3">
          <p className="text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
            {t("monitoring.buildingModalClassMwTitle")}
          </p>
          <div className="mt-2">
            <ClassMwLineChart values={classMwSeries} height={CHART_H} />
          </div>
        </div>
      : null}

      {frmOk && isGenerator ?
        <div className="rounded-lg border border-sf-border/70 bg-black/20 p-3">
          <p className="text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
            {t("monitoring.generatorCurvesTitle")}
          </p>
          <div className="mt-2">
            <GeneratorMwSupLineChart chartData={genChartData} height={CHART_H} />
          </div>
        </div>
      : null}

      <div className={isGenerator ? "grid gap-3" : `grid gap-3 ${showMap ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {!isGenerator ?
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
        : null}

        {!isGenerator ?
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
        : null}

        <div className="rounded-lg border border-sf-border/70 bg-black/25 p-3 ring-1 ring-white/[0.04] sm:p-3.5">
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
          : `mx-auto flex max-h-[min(calc(100dvh-24px),720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-sf-border/80 bg-[#14120f] shadow-2xl ring-1 ring-black/40 sm:my-auto`
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
              {!isGenerator ?
                <p className="mt-1 font-mono text-[0.65rem] text-sf-muted">
                  {t("monitoring.productionFilterEfficiency")}: {formatDecimalSpaces(effPct, 1)}%
                </p>
              : null}
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
