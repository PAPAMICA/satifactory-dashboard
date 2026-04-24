import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import { useTranslation } from "react-i18next";
import { FrmWorldMapCompact } from "@/components/FrmWorldMapCompact";
import { IconLayers, IconTrendUp } from "@/components/InventoryIcons";
import { FrmPowerByBuildingType, totalGeneratorMw } from "@/components/FrmPowerByBuildingType";
import { FrmPowerSummaryGrid } from "@/components/FrmPowerSummaryGrid";
import { FrmPowerTrendPanel } from "@/components/FrmPowerTrendPanel";
import { FrmDashboardControlWidget } from "@/components/FrmDashboardControlWidget";
import { FicsitPageLoader } from "@/components/FicsitPageLoader";
import { ItemThumb } from "@/components/ItemThumb";
import { useMergedInventoryItems } from "@/hooks/useMergedInventoryItems";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiFetch } from "@/lib/api";
import { asFrmRowArray } from "@/lib/frmRows";
import {
  catalogWidgets,
  dashboardWidgetById,
  ensureWidgetMeta,
  newLayoutItemForWidget,
  type ControlPinMeta,
  type WidgetMetaEntry,
  type WidgetVariant,
} from "@/lib/dashboardWidgetCatalog";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import { formatDecimalSpaces, formatIntegerSpaces } from "@/lib/formatNumber";
import { itemDisplayName, type InventoryItemRow } from "@/lib/items";
import {
  aggregatePowerMwByBuildType,
  generatorMwLive,
  powerMWFromUsageRow,
} from "@/lib/monitoringFrm";
import { CHART_TIME_WINDOWS, type ChartTimeWindow } from "@/lib/powerHistoryChart";

const Grid = WidthProvider(GridLayout);

const mdUp = "(min-width: 768px)";

type Settings = {
  frmBaseUrl: string;
  frmTokenConfigured: boolean;
  pollIntervalMs: number;
};

type LayoutDto = {
  layout: Layout[];
  widgetMeta: Record<string, WidgetMetaEntry>;
};

function fmtMw(n: number): string {
  const v = Math.round(n * 10) / 10;
  return `${formatDecimalSpaces(v, 1)} MW`;
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3h6l1 2h5v2H3V5h5l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9zM4 7h16l-1 14H5L4 7z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

function IconLayoutSwap({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h7V4l4 3-4 3V8H4V6zm16 8h-7v2l-4-3 4-3v2h7v2z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

type SessionInfo = {
  SessionName?: string;
  IsPaused?: boolean;
  PassedDays?: number;
  Hours?: number;
  Minutes?: number;
  Seconds?: number;
  IsDay?: boolean;
  TotalPlayDurationText?: string;
  NumberOfDaysSinceLastDeath?: number;
};

type CostLine = {
  Name?: string;
  ClassName?: string;
  Amount?: number;
  RemainingCost?: number;
  TotalCost?: number;
};

type HubTerminalRow = Record<string, unknown> & {
  HasActiveMilestone?: boolean;
  ActiveMilestone?: {
    Name?: string;
    ClassName?: string;
    TechTier?: number;
    Cost?: CostLine[];
  };
  SchName?: string;
  ShipDock?: boolean;
  ShipReturn?: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function parseSessionInfo(raw: unknown): SessionInfo | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    return (asRecord(raw[0]) as SessionInfo) ?? null;
  }
  return asRecord(raw) as SessionInfo | null;
}

function pickActiveHubTerminal(raw: unknown): HubTerminalRow | null {
  if (!Array.isArray(raw)) return null;
  for (const row of raw) {
    const o = asRecord(row) as HubTerminalRow | null;
    if (!o) continue;
    if (o.HasActiveMilestone === true && o.ActiveMilestone && typeof o.ActiveMilestone === "object") {
      return o;
    }
  }
  return null;
}

function firstElevatorPhase(raw: unknown): CostLine[] {
  if (!Array.isArray(raw) || !raw.length) return [];
  const o = asRecord(raw[0]);
  const phase = o?.CurrentPhase;
  return Array.isArray(phase) ? (phase as CostLine[]) : [];
}

function sortLayoutReadingOrder(layout: Layout[]): Layout[] {
  return [...layout].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
}

function deliveredAmount(c: CostLine): number {
  const total = Number(c.TotalCost);
  const rem = Number(c.RemainingCost);
  if (Number.isFinite(total) && Number.isFinite(rem)) {
    return Math.max(0, Math.min(total, total - rem));
  }
  return 0;
}

function deliveryProgressFraction(target: number, delivered: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0;
  const d = Math.max(0, Math.min(target, delivered));
  return Math.min(1, d / target);
}

function ItemProgressBar({ fraction }: { fraction: number }) {
  const pct = Math.round(fraction * 100);
  return (
    <div
      className="w-full min-w-0 max-w-full"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-1 w-full min-w-0 overflow-hidden rounded-full bg-black/45 ring-1 ring-sf-border/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sf-orange/90 to-sf-cyan/80 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Icône « Bon FICSIT » / coupon sink (même classe que les traductions items). */
const SINK_COUPON_CLASS = "Desc_ResourceSinkCoupon_C";

function fmtSinkTrendPerMin(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  const sign = rate > 0 ? "+" : "";
  return `${sign}${formatDecimalSpaces(rate, 1)}`;
}

function DashboardSinkEntry({
  row,
  variant,
  sectionLabel,
  metricKey,
  pointsPerMin,
}: {
  row: Record<string, unknown>;
  variant: WidgetVariant;
  sectionLabel: string;
  /** Clé API `/api/metrics/sink-rates` (ex. `sink_resource_0`). */
  metricKey: string;
  /** Points/min (moyenne dernière minute, séries 2 min en base). */
  pointsPerMin: number | null;
}) {
  const { t } = useTranslation();
  const name = String(row.Name ?? "—");
  const coupons =
    row.NumCoupon != null && Number.isFinite(Number(row.NumCoupon)) ?
      formatIntegerSpaces(Number(row.NumCoupon))
    : "—";
  const pct = fmtSinkPct(row.Percent);
  const pctNum = Math.min(100, Math.max(0, Number(row.Percent) || 0));
  const next =
    row.PointsToCoupon != null && Number.isFinite(Number(row.PointsToCoupon)) ?
      formatIntegerSpaces(Math.round(Number(row.PointsToCoupon)))
    : "—";
  const rateStr = fmtSinkTrendPerMin(pointsPerMin);
  const rateClass =
    pointsPerMin == null || !Number.isFinite(pointsPerMin) ? "text-sf-muted"
    : pointsPerMin > 0 ? "text-sf-ok"
    : pointsPerMin < 0 ? "text-sf-orange"
    : "text-sf-muted";

  if (variant === "visual") {
    return (
      <div className="flex min-h-0 flex-col gap-2.5 rounded-lg border border-sf-border/80 bg-black/25 p-3 shadow-sm ring-1 ring-white/[0.04]">
        <div className="flex flex-col items-center gap-1">
          <ItemThumb className={SINK_COUPON_CLASS} label="" size={72} />
          <p className="text-[0.6rem] uppercase tracking-wider text-sf-muted">{sectionLabel}</p>
          <p className="line-clamp-2 w-full text-center text-sm font-semibold text-sf-cream">{name}</p>
        </div>
        <ItemProgressBar fraction={pctNum / 100} />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-sf-border/60 bg-black/20 px-2 py-1.5">
            <p className="text-[0.58rem] uppercase tracking-wider text-sf-muted">{t("dashboard.widgets.sinkCoupons")}</p>
            <p className="mt-0.5 font-mono text-sf-cream">{coupons}</p>
          </div>
          <div className="rounded-md border border-sf-border/60 bg-black/20 px-2 py-1.5">
            <p className="text-[0.58rem] uppercase tracking-wider text-sf-muted">{t("dashboard.widgets.sinkPercent")}</p>
            <p className="mt-0.5 font-mono text-sf-orange">{pct}</p>
          </div>
          <div className="rounded-md border border-sf-border/60 bg-black/20 px-2 py-1.5">
            <p className="text-[0.58rem] uppercase tracking-wider text-sf-muted">{t("dashboard.widgets.sinkPointsNext")}</p>
            <p className="mt-0.5 font-mono text-sf-cyan">{next}</p>
          </div>
          <div className="rounded-md border border-sf-border/60 bg-black/20 px-2 py-1.5">
            <p className="text-[0.58rem] uppercase tracking-wider text-sf-muted">{t("dashboard.widgets.sinkTrendPtsMin")}</p>
            <p className={`mt-0.5 flex flex-wrap items-baseline gap-0.5 font-mono ${rateClass}`}>
              <span>{rateStr}</span>
              {rateStr !== "—" ? <span className="text-[0.55rem] font-normal text-sf-muted">/min</span> : null}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <li className="flex min-w-0 gap-2.5 rounded-lg border border-sf-border/60 bg-black/20 px-2 py-2 sm:gap-3 sm:px-3 sm:py-2.5">
      <ItemThumb className={SINK_COUPON_CLASS} label="" size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="shrink-0 text-[0.58rem] uppercase tracking-wider text-sf-muted sm:text-[0.6rem]">
            {sectionLabel}
          </span>
          <span className="min-w-0 truncate text-sm font-semibold text-sf-cream">{name}</span>
        </div>
        <div className="mt-1.5 min-w-0">
          <ItemProgressBar fraction={pctNum / 100} />
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[0.65rem] sm:grid-cols-4 sm:text-xs">
          <div className="min-w-0">
            <dt className="text-sf-muted">{t("dashboard.widgets.sinkCoupons")}</dt>
            <dd className="font-mono text-sf-cream">{coupons}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sf-muted">{t("dashboard.widgets.sinkPercent")}</dt>
            <dd className="font-mono text-sf-orange">{pct}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sf-muted">{t("dashboard.widgets.sinkPointsNext")}</dt>
            <dd className="font-mono text-sf-cyan">{next}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sf-muted">{t("dashboard.widgets.sinkTrendPtsMin")}</dt>
            <dd className={`flex flex-wrap items-baseline gap-0.5 font-mono ${rateClass}`}>
              <span>{rateStr}</span>
              {rateStr !== "—" ? <span className="text-[0.55rem] font-normal text-sf-muted">/min</span> : null}
            </dd>
          </div>
        </dl>
      </div>
    </li>
  );
}

/** Réponses sink FRM : tableau ou objet unique. */
function asSinkRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") return [data as Record<string, unknown>];
  return [];
}

function fmtSinkPct(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${Math.round(n * 10) / 10}%` : "—";
}

/** `ClassName` FRM si présent, sinon image de repli depuis `src/img`. */
function rowClassForThumb(r: Record<string, unknown>, fallback: string): string {
  const c = String(r.ClassName ?? r.className ?? "").trim();
  return c || fallback;
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const isDesktop = useMediaQuery(mdUp);
  const qc = useQueryClient();
  const [layout, setLayout] = useState<Layout[] | null>(null);
  const metaRef = useRef<Record<string, WidgetMetaEntry>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [metaGen, setMetaGen] = useState(0);
  const [chartWindow, setChartWindow] = useState<ChartTimeWindow>("30m");

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ isPublicViewer?: boolean; isAdmin?: boolean }>("/api/me"),
    staleTime: 60_000,
  });
  const readOnlyDashboard = Boolean(me?.isPublicViewer);

  useEffect(() => {
    if (!readOnlyDashboard) return;
    setEditMode(false);
    setCatalogOpen(false);
  }, [readOnlyDashboard]);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<Settings>("/api/settings"),
    staleTime: 5_000,
    refetchInterval: 45_000,
  });

  const interval = settings?.pollIntervalMs ?? 10_000;
  const frmOk = Boolean(settings?.frmTokenConfigured);

  const sinkExplorationHidden = useMemo(() => {
    const hasSink = layout?.some((l) => l.i === "sink") ?? false;
    if (!hasSink) return false;
    return metaRef.current.sink?.hideSinkExploration === true;
  }, [layout, metaGen]);

  const powerQuery = useQuery({
    queryKey: ["frm", "getPower"],
    queryFn: () => apiFetch<unknown>("/api/frm/getPower"),
    refetchInterval: interval,
    refetchIntervalInBackground: true,
    staleTime: 0,
    enabled: frmOk,
  });

  const invQuery = useQuery({
    queryKey: ["inventory", "summary"],
    queryFn: () => apiFetch<{ items: InventoryItemRow[] }>("/api/inventory/summary"),
    refetchInterval: interval,
    enabled: frmOk,
  });

  const invRatesQuery = useQuery({
    queryKey: ["inventory", "rates"],
    queryFn: () => apiFetch<{ rates: Record<string, number> }>("/api/inventory/rates"),
    refetchInterval: interval,
    refetchIntervalInBackground: true,
    staleTime: 0,
    enabled: frmOk,
  });

  const sinkRatesQuery = useQuery({
    queryKey: ["metrics", "sink-rates"],
    queryFn: () => apiFetch<{ rates: Record<string, number> }>("/api/metrics/sink-rates"),
    refetchInterval: interval,
    refetchIntervalInBackground: true,
    staleTime: 0,
    enabled: frmOk,
  });

  const favoritesQuery = useQuery({
    queryKey: ["favorites"],
    queryFn: () => apiFetch<{ favorites: string[] }>("/api/favorites"),
    enabled: frmOk,
    staleTime: 30_000,
  });

  const mergedInvItems = useMergedInventoryItems(
    invQuery.data?.items,
    favoritesQuery.data?.favorites,
    i18n.language,
  );

  const inventoryRates = invRatesQuery.data?.rates ?? {};

  const sessionQuery = useQuery({
    queryKey: ["frm", "getSessionInfo"],
    queryFn: () => apiFetch<unknown>("/api/frm/getSessionInfo"),
    refetchInterval: interval,
    enabled: frmOk,
  });

  const hubQuery = useQuery({
    queryKey: ["frm", "getHubTerminal"],
    queryFn: () => apiFetch<unknown>("/api/frm/getHubTerminal"),
    refetchInterval: interval,
    enabled: frmOk,
  });

  const elevatorQuery = useQuery({
    queryKey: ["frm", "getSpaceElevator"],
    queryFn: () => apiFetch<unknown>("/api/frm/getSpaceElevator"),
    refetchInterval: interval,
    enabled: frmOk,
  });

  const powerUsageQuery = useQuery({
    queryKey: ["frm", "getPowerUsage"],
    queryFn: () => apiFetch<unknown>("/api/frm/getPowerUsage"),
    refetchInterval: interval,
    enabled: frmOk,
  });

  const generatorsQuery = useQuery({
    queryKey: ["frm", "getGenerators"],
    queryFn: () => apiFetch<unknown>("/api/frm/getGenerators"),
    refetchInterval: interval,
    enabled: frmOk,
  });

  const mapMarkersQuery = useQuery({
    queryKey: ["frm", "getMapMarkers"],
    queryFn: () => apiFetch<unknown>("/api/frm/getMapMarkers"),
    refetchInterval: interval,
    enabled: frmOk,
  });

  const droneQuery = useQuery({
    queryKey: ["frm", "getDrone"],
    queryFn: () => apiFetch<unknown>("/api/frm/getDrone"),
    refetchInterval: interval,
    enabled: frmOk,
  });

  const droneStationQuery = useQuery({
    queryKey: ["frm", "getDroneStation"],
    queryFn: () => apiFetch<unknown>("/api/frm/getDroneStation"),
    refetchInterval: interval,
    enabled: frmOk,
  });

  const frmPlayersQuery = useQuery({
    queryKey: ["frm", "getPlayer"],
    queryFn: () => apiFetch<unknown>("/api/frm/getPlayer"),
    refetchInterval: interval,
    enabled: frmOk,
  });

  const resourceSinkQuery = useQuery({
    queryKey: ["frm", "getResourceSink"],
    queryFn: () => apiFetch<unknown>("/api/frm/getResourceSink"),
    refetchInterval: interval,
    enabled: frmOk,
  });

  const explorationSinkQuery = useQuery({
    queryKey: ["frm", "getExplorationSink"],
    queryFn: () => apiFetch<unknown>("/api/frm/getExplorationSink"),
    refetchInterval: interval,
    enabled: frmOk && (layout?.some((l) => l.i === "sink") ?? false) && !sinkExplorationHidden,
  });

  const factoryListQuery = useQuery({
    queryKey: ["frm", "getFactory"],
    queryFn: () => apiFetch<unknown>("/api/frm/getFactory"),
    refetchInterval: Math.max(interval, 15_000),
    enabled: frmOk,
  });

  const layoutQuery = useQuery({
    queryKey: ["dashboard", "layout"],
    queryFn: () => apiFetch<LayoutDto>("/api/dashboard/layout"),
  });

  useEffect(() => {
    if (layoutQuery.data && !layout) {
      const lo = layoutQuery.data.layout as Layout[];
      metaRef.current = ensureWidgetMeta(lo, layoutQuery.data.widgetMeta ?? {});
      setLayout(lo);
    }
  }, [layoutQuery.data, layout]);

  const saveLayout = useMutation({
    mutationFn: async (payload: LayoutDto) => {
      await apiFetch("/api/dashboard/layout", { method: "PUT", json: payload });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dashboard", "layout"] });
      setSaveHint(t("dashboard.saved"));
      setTimeout(() => setSaveHint(null), 2000);
    },
  });

  const flushLayoutSave = useCallback(() => {
    if (readOnlyDashboard) return;
    if (!layout) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    metaRef.current = ensureWidgetMeta(layout, metaRef.current);
    saveLayout.mutate({ layout, widgetMeta: metaRef.current });
  }, [layout, saveLayout, readOnlyDashboard]);

  const scheduleSave = useCallback(
    (l: Layout[]) => {
      if (readOnlyDashboard) return;
      metaRef.current = ensureWidgetMeta(l, metaRef.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveLayout.mutate({ layout: l, widgetMeta: metaRef.current });
      }, 900);
    },
    [saveLayout, readOnlyDashboard],
  );

  const onLayoutChange = useCallback(
    (l: Layout[]) => {
      if (readOnlyDashboard) return;
      setLayout(l);
      scheduleSave(l);
    },
    [scheduleSave, readOnlyDashboard],
  );

  const addCatalogWidget = useCallback(
    (id: string) => {
      if (readOnlyDashboard) return;
      if (!layout) return;
      if (layout.some((x) => x.i === id)) return;
      if (!dashboardWidgetById(id)) return;
      const next = [...layout, newLayoutItemForWidget(id, layout)];
      metaRef.current = ensureWidgetMeta(next, metaRef.current);
      setMetaGen((g) => g + 1);
      setLayout(next);
      scheduleSave(next);
      setCatalogOpen(false);
    },
    [layout, scheduleSave, readOnlyDashboard],
  );

  const removeWidget = useCallback(
    (id: string) => {
      if (readOnlyDashboard) return;
      if (!layout) return;
      if (!dashboardWidgetById(id)) return;
      const next = layout.filter((l) => l.i !== id);
      delete metaRef.current[id];
      setMetaGen((g) => g + 1);
      setLayout(next);
      scheduleSave(next);
    },
    [layout, scheduleSave, readOnlyDashboard],
  );

  const toggleWidgetVariant = useCallback(
    (id: string) => {
      if (readOnlyDashboard) return;
      if (!layout) return;
      const cur = metaRef.current[id]?.variant === "visual" ? "visual" : "standard";
      const nextVariant: WidgetVariant = cur === "visual" ? "standard" : "visual";
      metaRef.current[id] = { ...metaRef.current[id], variant: nextVariant };
      setMetaGen((g) => g + 1);
      scheduleSave(layout);
    },
    [layout, scheduleSave, readOnlyDashboard],
  );

  const toggleSinkExplorationVisibility = useCallback(() => {
    if (readOnlyDashboard) return;
    if (!layout?.some((l) => l.i === "sink")) return;
    const cur = metaRef.current.sink ?? {};
    const wasHidden = cur.hideSinkExploration === true;
    if (wasHidden) {
      const next: WidgetMetaEntry = { ...cur };
      delete next.hideSinkExploration;
      metaRef.current.sink = next;
    } else {
      metaRef.current.sink = { ...cur, hideSinkExploration: true };
    }
    setMetaGen((g) => g + 1);
    scheduleSave(layout);
  }, [layout, scheduleSave, readOnlyDashboard]);

  const addControlPin = useCallback(
    (pin: ControlPinMeta) => {
      if (readOnlyDashboard || !layout?.some((l) => l.i === "ctrl")) return;
      const cur = metaRef.current.ctrl?.controlPins ?? [];
      if (cur.some((p) => p.id === pin.id && p.kind === pin.kind)) return;
      const prev = metaRef.current.ctrl ?? {};
      metaRef.current.ctrl = {
        ...prev,
        type: "control_pins",
        controlPins: [...cur, pin],
      };
      setMetaGen((g) => g + 1);
      scheduleSave(layout);
    },
    [layout, scheduleSave, readOnlyDashboard],
  );

  const removeControlPin = useCallback(
    (id: string, kind: ControlPinMeta["kind"]) => {
      if (readOnlyDashboard || !layout?.some((l) => l.i === "ctrl")) return;
      const cur = metaRef.current.ctrl?.controlPins ?? [];
      const prev = metaRef.current.ctrl ?? {};
      metaRef.current.ctrl = {
        ...prev,
        type: "control_pins",
        controlPins: cur.filter((p) => !(p.id === id && p.kind === kind)),
      };
      setMetaGen((g) => g + 1);
      scheduleSave(layout);
    },
    [layout, scheduleSave, readOnlyDashboard],
  );

  const widgetVariants = useMemo(() => {
    if (!layout) return {} as Record<string, WidgetVariant>;
    const m: Record<string, WidgetVariant> = {};
    for (const l of layout) {
      m[l.i] = metaRef.current[l.i]?.variant === "visual" ? "visual" : "standard";
    }
    return m;
  }, [layout, metaGen]);

  const favorites = useMemo(
    () => mergedInvItems.filter((i) => i.favorite).slice(0, 24),
    [mergedInvItems],
  );

  const invByClass = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of mergedInvItems) {
      m.set(it.className, it.amount);
    }
    return m;
  }, [mergedInvItems]);

  const sessionInfo = useMemo(() => parseSessionInfo(sessionQuery.data), [sessionQuery.data]);
  const hubRow = useMemo(() => pickActiveHubTerminal(hubQuery.data), [hubQuery.data]);
  const elevatorCosts = useMemo(() => firstElevatorPhase(elevatorQuery.data), [elevatorQuery.data]);

  const layoutSorted = useMemo(() => (layout ? sortLayoutReadingOrder(layout) : []), [layout]);

  const addableWidgets = useMemo(() => {
    if (!layout) return [];
    const ids = new Set(layout.map((l) => l.i));
    return catalogWidgets().filter((w) => {
      if (ids.has(w.id)) return false;
      if (w.id === "ctrl" && !me?.isAdmin) return false;
      return true;
    });
  }, [layout, me?.isAdmin]);

  const controlPins = useMemo(() => metaRef.current.ctrl?.controlPins ?? [], [layout, metaGen]);

  const renderFavorites = (variant: WidgetVariant, narrow: boolean) => {
    const thumb = variant === "visual" ? (narrow ? 48 : 56) : narrow ? 22 : 24;
    const fmtItemRate = (className: string) => {
      const r = inventoryRates[className];
      if (r === undefined) return "—";
      if (r > 0) return `+${formatDecimalSpaces(r, 1)}`;
      return "0";
    };
    const amt = (n: number) => formatIntegerSpaces(Math.round(n));
    const listUl = "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden";
    const cardUl =
      "grid min-h-0 w-full min-w-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2 overflow-y-auto overflow-x-hidden sm:gap-3 md:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]";
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
        {!favorites.length ? (
          <p className="text-sm text-sf-muted">{t("dashboard.noFavorites")}</p>
        ) : variant === "visual" ? (
              <ul className={cardUl}>
                {favorites.map((f) => {
                  const dn = itemDisplayName(f, i18n.language);
                  const rateStr = fmtItemRate(f.className);
                  return (
                    <li
                      key={f.className}
                      className="flex min-h-[148px] min-w-0 flex-col items-center gap-2 rounded-lg border border-sf-border/80 bg-black/25 p-2 text-center shadow-sm ring-1 ring-white/[0.04] sm:min-h-0 sm:p-3"
                    >
                      <div className="flex w-full shrink-0 justify-center">
                        <ItemThumb className={f.className} label={dn} size={thumb} />
                      </div>
                      <span className="line-clamp-3 min-h-0 w-full text-[0.7rem] leading-snug text-sf-cream sm:text-xs">
                        {dn}
                      </span>
                      <div className="mt-auto w-full flex flex-col gap-1.5 border-t border-sf-border/50 pt-2">
                        <div className="flex items-center justify-center gap-1.5 text-sf-cyan">
                          <IconLayers className="h-4 w-4 shrink-0 opacity-85" aria-hidden />
                          <span className="sf-display text-base font-semibold sm:text-lg">{amt(f.amount)}</span>
                        </div>
                        <div
                          className="flex items-center justify-center gap-1.5 text-sf-muted"
                          title={t("dashboard.favoritesRateHint")}
                        >
                          <IconTrendUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="font-mono text-[0.65rem] sm:text-xs">{rateStr}</span>
                          <span className="text-[0.55rem] opacity-80">/min</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className={listUl}>
                {favorites.map((f) => {
                  const dn = itemDisplayName(f, i18n.language);
                  const rateStr = fmtItemRate(f.className);
                  return (
                    <li
                      key={f.className}
                      className="grid min-h-0 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_minmax(0,auto)_minmax(0,auto)] items-center gap-1.5 rounded-lg border border-sf-border/80 bg-black/20 px-2 py-1.5 shadow-sm ring-1 ring-white/[0.03] sm:gap-2 sm:px-2.5 sm:py-2"
                    >
                      <ItemThumb className={f.className} label={dn} size={thumb} />
                      <span className="min-w-0 truncate text-[0.7rem] text-sf-text sm:text-xs">{dn}</span>
                      <span
                        className="inline-flex min-w-0 shrink items-center gap-0.5 font-mono text-[0.65rem] text-sf-cyan tabular-nums sm:text-xs"
                        title={t("inventory.total")}
                      >
                        <IconLayers className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                        {amt(f.amount)}
                      </span>
                      <span
                        className="inline-flex min-w-0 shrink justify-end gap-0.5 font-mono text-[0.6rem] text-sf-muted tabular-nums sm:text-[0.65rem]"
                        title={t("dashboard.favoritesRateHint")}
                      >
                        <IconTrendUp className="h-3 w-3 shrink-0 text-sf-orange/80" aria-hidden />
                        {rateStr}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
      </div>
    );
  };

  const renderSession = (variant: WidgetVariant) => {
    if (sessionQuery.isError) {
      return <p className="p-3 text-sm text-sf-danger">{t("common.error")}</p>;
    }
    if (sessionQuery.isPending) {
      return <p className="p-3 text-sm text-sf-muted">{t("common.loading")}</p>;
    }
    if (!sessionInfo) {
      return <p className="p-3 text-sm text-sf-muted">{t("dashboard.widgets.noSession")}</p>;
    }
    const onlinePlayersStr =
      frmPlayersQuery.isPending ? "…"
      : frmPlayersQuery.isError ? "—"
      : formatIntegerSpaces(asFrmRowArray(frmPlayersQuery.data).length);
    const clock =
      sessionInfo.Hours != null && sessionInfo.Minutes != null ?
        `${sessionInfo.Hours}h ${String(sessionInfo.Minutes).padStart(2, "0")}m`
      : "—";
    const sec =
      typeof sessionInfo.Seconds === "number" ? Math.floor(sessionInfo.Seconds) : undefined;
    const clockFull = sec != null ? `${clock} ${sec}s` : clock;
    const cells = (
      <>
        <StatMini
          label={t("dashboard.widgets.sessionPlayersOnline")}
          value={onlinePlayersStr}
          large={variant === "visual"}
        />
        <StatMini label={t("dashboard.widgets.sessionName")} value={sessionInfo.SessionName ?? "—"} large={variant === "visual"} />
        <StatMini
          label={t("dashboard.widgets.paused")}
          value={sessionInfo.IsPaused ? t("common.yes") : t("common.no")}
          large={variant === "visual"}
        />
        <StatMini label={t("dashboard.widgets.playTime")} value={sessionInfo.TotalPlayDurationText ?? "—"} large={variant === "visual"} />
        <StatMini label={t("dashboard.widgets.dayTime")} value={clockFull} large={variant === "visual"} />
        <StatMini
          label={t("dashboard.widgets.isDay")}
          value={sessionInfo.IsDay === undefined ? "—" : sessionInfo.IsDay ? t("common.yes") : t("common.no")}
          large={variant === "visual"}
        />
        <StatMini
          label={t("dashboard.widgets.passedDays")}
          value={
            sessionInfo.PassedDays != null && Number.isFinite(Number(sessionInfo.PassedDays)) ?
              formatIntegerSpaces(Number(sessionInfo.PassedDays))
            : "—"
          }
          large={variant === "visual"}
        />
        <StatMini
          label={t("dashboard.widgets.sinceDeath")}
          value={
            sessionInfo.NumberOfDaysSinceLastDeath != null &&
            Number.isFinite(Number(sessionInfo.NumberOfDaysSinceLastDeath)) ?
              formatIntegerSpaces(Number(sessionInfo.NumberOfDaysSinceLastDeath))
            : "—"
          }
          large={variant === "visual"}
        />
      </>
    );
    if (variant === "visual") {
      return (
        <div className="flex min-h-0 min-w-0 flex-col gap-3 p-3">
          <div className="grid min-h-0 min-w-0 grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-4">
            {cells}
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-0 min-w-0 flex-col gap-2 p-2 text-sm sm:gap-3 sm:p-3">
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
          {cells}
        </div>
      </div>
    );
  };

  const renderHub = (variant: WidgetVariant) => {
    if (hubQuery.isError) {
      return <p className="p-3 text-sm text-sf-danger">{t("common.error")}</p>;
    }
    if (hubQuery.isPending) {
      return <p className="p-3 text-sm text-sf-muted">{t("common.loading")}</p>;
    }
    const ms = hubRow?.ActiveMilestone;
    if (!hubRow || !ms) {
      return <p className="p-3 text-sm text-sf-muted">{t("dashboard.widgets.noMilestone")}</p>;
    }
    const costs = Array.isArray(ms.Cost) ? ms.Cost : [];
    const milestoneArt = String(ms.ClassName ?? "").trim() || "Build_Workshop_C";
    const tier =
      ms.TechTier != null && Number.isFinite(Number(ms.TechTier)) ?
        formatIntegerSpaces(Number(ms.TechTier))
      : ms.TechTier != null ?
        String(ms.TechTier)
      : "—";
    const milestoneTitle = ms.Name ?? hubRow.SchName ?? "—";
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2 sm:p-3">
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          <ItemThumb className={milestoneArt} label="" size={variant === "visual" ? 52 : 40} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="min-w-0 max-w-full truncate text-sm font-semibold leading-snug text-sf-orange">
                {milestoneTitle}
              </p>
              <span className="shrink-0 text-xs text-sf-muted">
                {t("dashboard.widgets.tier")}: <span className="font-mono text-sf-cyan">{tier}</span>
              </span>
              {hubRow.ShipDock !== undefined ? (
                <span
                  className={
                    "shrink-0 text-xs " +
                    (hubRow.ShipDock ?
                      "rounded bg-sf-ok/15 px-1.5 py-0.5 text-sf-ok"
                    : "rounded bg-sf-orange/10 px-1.5 py-0.5 text-sf-orange")
                  }
                >
                  {t("dashboard.widgets.ship")}:{" "}
                  {hubRow.ShipDock ? t("dashboard.widgets.docked") : t("dashboard.widgets.away")}
                </span>
              ) : null}
              {hubRow.ShipReturn ? (
                <span className="min-w-0 max-w-full truncate text-xs text-sf-muted">
                  {t("dashboard.widgets.returnEta")}:{" "}
                  <span className="text-sf-cream">{String(hubRow.ShipReturn)}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <CostProgressTable
          rows={costs}
          invByClass={invByClass}
          lang={i18n.language}
          t={t}
          variant={variant}
          omitDeliveredColumn
        />
      </div>
    );
  };

  const renderElevator = (variant: WidgetVariant) => {
    if (elevatorQuery.isError) {
      return <p className="p-3 text-sm text-sf-danger">{t("common.error")}</p>;
    }
    if (elevatorQuery.isPending) {
      return <p className="p-3 text-sm text-sf-muted">{t("common.loading")}</p>;
    }
    if (!elevatorCosts.length) {
      return <p className="p-3 text-sm text-sf-muted">{t("dashboard.widgets.noElevator")}</p>;
    }
    const raw0 = Array.isArray(elevatorQuery.data) ? elevatorQuery.data[0] : null;
    const ex = asRecord(raw0);
    const fully = ex?.FullyUpgraded === true;
    const ready = ex?.UpgradeReady === true;
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2 sm:p-3">
        {fully || ready ? (
          <div className="flex flex-wrap gap-2">
            {fully ? (
              <span className="rounded bg-sf-ok/15 px-2 py-1 text-xs text-sf-ok">{t("dashboard.widgets.elevatorComplete")}</span>
            ) : null}
            {ready ? (
              <span className="rounded bg-sf-orange/15 px-2 py-1 text-xs text-sf-orange">
                {t("dashboard.widgets.elevatorReady")}
              </span>
            ) : null}
          </div>
        ) : null}
        <CostProgressTable
          rows={elevatorCosts}
          invByClass={invByClass}
          lang={i18n.language}
          t={t}
          variant={variant}
          omitDeliveredColumn
        />
      </div>
    );
  };

  const renderSink = (variant: WidgetVariant, hideExploration: boolean) => {
    if (resourceSinkQuery.isError) {
      return <p className="p-3 text-sm text-sf-danger">{t("common.error")}</p>;
    }
    if (!hideExploration && explorationSinkQuery.isError) {
      return <p className="p-3 text-sm text-sf-danger">{t("common.error")}</p>;
    }
    if (resourceSinkQuery.isPending) {
      return <p className="p-3 text-sm text-sf-muted">{t("common.loading")}</p>;
    }
    if (!hideExploration && explorationSinkQuery.isPending) {
      return <p className="p-3 text-sm text-sf-muted">{t("common.loading")}</p>;
    }
    const resRows = asSinkRows(resourceSinkQuery.data);
    const expRows = hideExploration ? [] : asSinkRows(explorationSinkQuery.data);
    const sinkRates = sinkRatesQuery.data?.rates ?? {};
    const ptsMin = (kind: "resource" | "exploration", i: number) => {
      const k = `sink_${kind}_${i}`;
      const v = sinkRates[k];
      return v !== undefined && Number.isFinite(v) ? v : null;
    };
    if (!resRows.length && !expRows.length) {
      return <p className="p-3 text-sm text-sf-muted">{t("monitoring.empty")}</p>;
    }
    if (variant === "visual") {
      return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-2 sm:p-3">
          <div className="grid min-h-0 min-w-0 grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-3">
            {resRows.map((row, i) => (
              <DashboardSinkEntry
                key={`r-${i}`}
                row={row}
                variant={variant}
                sectionLabel={t("dashboard.widgets.sinkResource")}
                metricKey={`sink_resource_${i}`}
                pointsPerMin={ptsMin("resource", i)}
              />
            ))}
            {expRows.map((row, i) => (
              <DashboardSinkEntry
                key={`e-${i}`}
                row={row}
                variant={variant}
                sectionLabel={t("dashboard.widgets.sinkExploration")}
                metricKey={`sink_exploration_${i}`}
                pointsPerMin={ptsMin("exploration", i)}
              />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-2 sm:p-3">
        <ul className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          {resRows.map((row, i) => (
            <DashboardSinkEntry
              key={`r-${i}`}
              row={row}
              variant={variant}
              sectionLabel={t("dashboard.widgets.sinkResource")}
              metricKey={`sink_resource_${i}`}
              pointsPerMin={ptsMin("resource", i)}
            />
          ))}
          {expRows.map((row, i) => (
            <DashboardSinkEntry
              key={`e-${i}`}
              row={row}
              variant={variant}
              sectionLabel={t("dashboard.widgets.sinkExploration")}
              metricKey={`sink_exploration_${i}`}
              pointsPerMin={ptsMin("exploration", i)}
            />
          ))}
        </ul>
      </div>
    );
  };

  const renderDrones = (variant: WidgetVariant) => {
    if (droneQuery.isError || droneStationQuery.isError) {
      return <p className="p-3 text-sm text-sf-danger">{t("common.error")}</p>;
    }
    if (droneQuery.isPending || droneStationQuery.isPending) {
      return <p className="p-3 text-sm text-sf-muted">{t("common.loading")}</p>;
    }
    const fleet = asFrmRowArray(droneQuery.data);
    const ports = asFrmRowArray(droneStationQuery.data);
    const droneList = (
      rows: Record<string, unknown>[],
      limit: number,
      thumb: (r: Record<string, unknown>) => string,
      thumbSize: number,
    ) => (
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto text-xs">
        {rows.slice(0, limit).map((r, i) => {
          const tc = thumb(r);
          const sub = frmgClassLabel(tc, i18n.language);
          return (
            <li
              key={String(r.ID ?? r.id ?? i)}
              className="flex min-h-0 items-center gap-1.5 rounded-lg border border-sf-border/50 bg-black/15 px-1.5 py-1 sm:gap-2 sm:px-2 sm:py-1.5"
            >
              <ItemThumb className={tc} label="" size={thumbSize} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sf-cream">{String(r.Name ?? r.name ?? "—")}</p>
                {sub && sub !== "—" ? <p className="truncate text-[0.6rem] text-sf-muted">{sub}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
    if (variant === "visual") {
      return (
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 overflow-auto p-2 sm:grid-cols-2 sm:p-3">
          <div className="flex min-h-0 min-w-0 flex-col rounded-lg border border-sf-border bg-black/25 p-3">
            <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("dashboard.widgets.droneFleet")}</p>
            <p className="sf-display mt-1 text-2xl font-semibold text-sf-orange">
              {formatIntegerSpaces(fleet.length)}
            </p>
            {droneList(fleet, 12, (r) => rowClassForThumb(r, "Desc_DroneTransport_C"), 36)}
          </div>
          <div className="flex min-h-0 min-w-0 flex-col rounded-lg border border-sf-border bg-black/25 p-3">
            <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("dashboard.widgets.droneStations")}</p>
            <p className="sf-display mt-1 text-2xl font-semibold text-sf-cyan">
              {formatIntegerSpaces(ports.length)}
            </p>
            {droneList(ports, 12, (r) => rowClassForThumb(r, "Build_DroneStation_C"), 36)}
          </div>
        </div>
      );
    }
    return (
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-2 overflow-auto p-2 sm:grid-cols-2 sm:gap-3 sm:p-3">
        <div className="flex min-h-0 min-w-0 flex-col rounded border border-sf-border/60 bg-black/15 p-2">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("dashboard.widgets.droneFleet")}</span>
            <span className="font-mono text-sm text-sf-orange">{formatIntegerSpaces(fleet.length)}</span>
          </div>
          {droneList(fleet, 20, (r) => rowClassForThumb(r, "Desc_DroneTransport_C"), 28)}
        </div>
        <div className="flex min-h-0 min-w-0 flex-col rounded border border-sf-border/60 bg-black/15 p-2">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("dashboard.widgets.droneStations")}</span>
            <span className="font-mono text-sm text-sf-cyan">{formatIntegerSpaces(ports.length)}</span>
          </div>
          {droneList(ports, 20, (r) => rowClassForThumb(r, "Build_DroneStation_C"), 28)}
        </div>
      </div>
    );
  };

  const renderMapMarkers = (_variant: WidgetVariant) => {
    if (mapMarkersQuery.isError) {
      return <p className="p-3 text-sm text-sf-danger">{t("common.error")}</p>;
    }
    if (mapMarkersQuery.isPending) {
      return <p className="p-3 text-sm text-sf-muted">{t("common.loading")}</p>;
    }
    const rows = asFrmRowArray(mapMarkersQuery.data);
    return (
      <div className="box-border flex h-full min-h-[min(52vh,320px)] w-full min-w-0 flex-1 flex-col overflow-hidden px-2 pb-2 pt-0 sm:px-3 sm:pb-3">
        <FrmWorldMapCompact markers={rows} scrollWheelZoom={false} className="min-h-0 min-w-0 flex-1 rounded-md border border-sf-border/40" />
        <p className="shrink-0 border-t border-sf-border/50 py-1.5 text-center text-[0.65rem] text-sf-muted">
          {t("dashboard.widgets.mapMarkersCount", { n: rows.length })}
        </p>
      </div>
    );
  };

  const renderPlayers = (variant: WidgetVariant) => {
    if (frmPlayersQuery.isError) {
      return <p className="p-3 text-sm text-sf-danger">{t("common.error")}</p>;
    }
    if (frmPlayersQuery.isPending) {
      return <p className="p-3 text-sm text-sf-muted">{t("common.loading")}</p>;
    }
    const rows = asFrmRowArray(frmPlayersQuery.data);
    if (!rows.length) {
      return <p className="p-3 text-sm text-sf-muted">{t("dashboard.widgets.noPlayers")}</p>;
    }
    if (variant === "visual") {
      return (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto p-2 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:p-3">
          {rows.map((r, i) => (
            <div
              key={String(r.ID ?? r.PlayerName ?? i)}
              className="flex flex-col items-center gap-2 rounded-lg border border-sf-border/80 bg-black/25 p-3 text-center shadow-sm ring-1 ring-white/[0.04] sm:items-start sm:text-left"
            >
              <ItemThumb className={rowClassForThumb(r, "Build_StoragePlayer_C")} label="" size={48} />
              <div className="min-w-0 w-full">
                <p className="truncate text-sm font-medium text-sf-cream">{String(r.PlayerName ?? r.Name ?? "—")}</p>
                <p className="mt-1 font-mono text-[0.65rem] text-sf-muted">
                  ID{" "}
                  {r.ID != null && Number.isFinite(Number(r.ID)) ?
                    formatIntegerSpaces(Number(r.ID))
                  : String(r.ID ?? "—")}
                </p>
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="min-h-0 flex-1 overflow-hidden p-1.5 sm:p-3">
        <ul className="h-full max-h-full space-y-1 overflow-y-auto sm:space-y-1.5">
          {rows.map((r, i) => {
            const idStr =
              r.ID != null && Number.isFinite(Number(r.ID)) ?
                formatIntegerSpaces(Number(r.ID))
              : String(r.ID ?? "—");
            return (
              <li
                key={String(r.ID ?? r.PlayerName ?? i)}
                className="flex min-h-0 items-center gap-1.5 rounded border border-sf-border/40 bg-black/15 px-1.5 py-1.5 sm:gap-2 sm:px-2 sm:py-2"
              >
                <ItemThumb className={rowClassForThumb(r, "Build_StoragePlayer_C")} label="" size={22} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-sf-cream">{String(r.PlayerName ?? r.Name ?? "—")}</p>
                  <p className="mt-0.5 font-mono text-[0.65rem] text-sf-muted">ID {idStr}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const renderPowerUsage = (variant: WidgetVariant) => {
    if (powerUsageQuery.isError) {
      return <p className="p-3 text-sm text-sf-danger">{t("common.error")}</p>;
    }
    if (powerUsageQuery.isPending) {
      return <p className="p-3 text-sm text-sf-muted">{t("common.loading")}</p>;
    }
    const raw = asFrmRowArray(powerUsageQuery.data);
    const entries = aggregatePowerMwByBuildType(raw, powerMWFromUsageRow);
    return (
      <FrmPowerByBuildingType
        variant={variant}
        entries={entries}
        kind="consumption"
        usageHistoryRows={raw}
        usageHistoryUpdatedAt={powerUsageQuery.dataUpdatedAt}
      />
    );
  };

  const renderGenerators = (variant: WidgetVariant) => {
    if (generatorsQuery.isError) {
      return <p className="p-3 text-sm text-sf-danger">{t("common.error")}</p>;
    }
    if (generatorsQuery.isPending) {
      return <p className="p-3 text-sm text-sf-muted">{t("common.loading")}</p>;
    }
    const rows = asFrmRowArray(generatorsQuery.data);
    const entries = aggregatePowerMwByBuildType(rows, generatorMwLive);
    const totalMw = totalGeneratorMw(rows, generatorMwLive);
    const summaries = [
      { label: t("dashboard.widgets.generatorsTotal"), value: formatIntegerSpaces(rows.length) },
      { label: t("dashboard.widgets.generatorsLiveMw"), value: fmtMw(totalMw) },
    ];
    return (
      <FrmPowerByBuildingType
        variant={variant}
        entries={entries}
        kind="production"
        summaries={summaries}
        maxVisualItems={12}
        maxListItems={20}
      />
    );
  };

  const renderFactoryList = (variant: WidgetVariant) => {
    if (factoryListQuery.isError) {
      return <p className="p-3 text-sm text-sf-danger">{t("common.error")}</p>;
    }
    if (factoryListQuery.isPending) {
      return <p className="p-3 text-sm text-sf-muted">{t("common.loading")}</p>;
    }
    const rows = asFrmRowArray(factoryListQuery.data);
    const slice = rows.slice(0, variant === "visual" ? 12 : 28);
    if (variant === "visual") {
      return (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto p-2 sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] sm:p-3">
          {slice.map((r, i) => {
            const fc = rowClassForThumb(r, "Build_ManufacturerMk1_C");
            const typeLbl = frmgClassLabel(fc, i18n.language);
            return (
              <div
                key={String(r.ID ?? r.id ?? i)}
                className="flex flex-col gap-2 rounded-lg border border-sf-border/80 bg-black/25 p-2 shadow-sm ring-1 ring-white/[0.04] sm:flex-row sm:items-start"
              >
                <ItemThumb className={fc} label="" size={52} />
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="line-clamp-2 text-sm font-semibold text-sf-cream">{String(r.Name ?? r.name ?? "—")}</p>
                  <p className="mt-1 text-[0.65rem] uppercase tracking-wider text-sf-muted">
                    {t("dashboard.widgets.factoryBuildingType")}
                  </p>
                  <p className="truncate text-xs text-sf-muted">{typeLbl}</p>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    return (
      <div className="min-h-0 flex-1 overflow-hidden p-1.5 sm:p-3">
        <p className="mb-1.5 text-[0.6rem] text-sf-muted sm:mb-2 sm:text-[0.65rem]">
          {t("dashboard.widgets.factoryHint", {
            shown: formatIntegerSpaces(slice.length),
            total: formatIntegerSpaces(rows.length),
          })}
        </p>
        <ul className="max-h-[min(48vh,320px)] space-y-1 overflow-y-auto sm:space-y-1.5">
          {slice.map((r, i) => {
            const fc = rowClassForThumb(r, "Build_ManufacturerMk1_C");
            const typeLbl = frmgClassLabel(fc, i18n.language);
            return (
              <li
                key={String(r.ID ?? r.id ?? i)}
                className="flex min-h-0 items-center gap-1.5 rounded-lg border border-sf-border/50 bg-black/15 px-1.5 py-1.5 sm:gap-2 sm:px-2 sm:py-2"
              >
                <ItemThumb className={fc} label="" size={22} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-sf-cream">{String(r.Name ?? r.name ?? "—")}</p>
                  <p className="truncate text-[0.6rem] text-sf-muted">{typeLbl}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const widgetHeader = (id: string, drag: boolean) => {
    const def = dashboardWidgetById(id);
    const title = def ? t(def.titleKey) : id;
    const variantIsVisual = widgetVariants[id] === "visual";
    const art = def?.artClassName;
    return (
      <div className="sf-panel-header flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
        <div
          className={`flex min-w-0 max-w-full flex-1 items-center gap-2 ${drag && editMode ? "drag-handle cursor-move" : ""}`}
        >
          {art ? <ItemThumb className={art} label="" size={28} /> : null}
          <span className="min-w-0 flex-1 truncate">{title}</span>
        </div>
        {id === "chart" ? (
          <div
            role="group"
            aria-label={t("dashboard.chartWindowAria")}
            className="flex max-w-full shrink-0 gap-0.5 overflow-x-auto rounded border border-sf-border/60 bg-black/20 p-0.5"
          >
            {CHART_TIME_WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.55rem] leading-tight transition-colors sm:text-[0.6rem] ${
                  chartWindow === w
                    ? "bg-sf-orange/25 text-sf-orange ring-1 ring-sf-orange/50"
                    : "text-sf-muted hover:bg-black/30 hover:text-sf-text"
                }`}
                onClick={() => setChartWindow(w)}
              >
                {t(`dashboard.chartWindows.${w}`)}
              </button>
            ))}
          </div>
        ) : null}
        <span
          className={
            "shrink-0 rounded px-1.5 py-0.5 text-[0.55rem] uppercase tracking-wider " +
            (variantIsVisual ? "bg-sf-orange/15 text-sf-orange" : "bg-black/30 text-sf-muted")
          }
        >
          {variantIsVisual ? t("dashboard.widgets.cardsBadge") : t("dashboard.widgets.listBadge")}
        </span>
        {editMode ? (
          <div className="flex shrink-0 items-center gap-0.5">
            {id === "sink" ? (
              <button
                type="button"
                className={
                  "shrink-0 rounded px-2 py-1 text-[0.55rem] font-medium uppercase tracking-wider transition-colors " +
                  (sinkExplorationHidden ?
                    "bg-sf-orange/20 text-sf-orange ring-1 ring-sf-orange/40"
                  : "bg-black/30 text-sf-muted hover:bg-black/45 hover:text-sf-text")
                }
                title={
                  sinkExplorationHidden ?
                    t("dashboard.sinkExplorationShow")
                  : t("dashboard.sinkExplorationHide")
                }
                aria-label={
                  sinkExplorationHidden ?
                    t("dashboard.sinkExplorationShow")
                  : t("dashboard.sinkExplorationHide")
                }
                aria-pressed={sinkExplorationHidden}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => toggleSinkExplorationVisibility()}
              >
                {t("dashboard.sinkExplorationBadge")}
              </button>
            ) : null}
            <button
              type="button"
              className="rounded p-1.5 text-sf-muted hover:bg-black/40 hover:text-sf-orange"
              title={variantIsVisual ? t("dashboard.toggleToList") : t("dashboard.toggleToCards")}
              aria-label={variantIsVisual ? t("dashboard.toggleToList") : t("dashboard.toggleToCards")}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => toggleWidgetVariant(id)}
            >
              <IconLayoutSwap className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded p-1.5 text-sf-muted hover:bg-black/40 hover:text-sf-danger"
              title={t("dashboard.removeWidget")}
              aria-label={t("dashboard.removeWidget")}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => removeWidget(id)}
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderWidgetBody = (id: string) => {
    const v = widgetVariants[id] === "visual" ? "visual" : "standard";
    switch (id) {
      case "power":
        return (
          <FrmPowerSummaryGrid
            circuits={(powerQuery.data as Record<string, unknown>[] | undefined) ?? []}
            variant={v}
          />
        );
      case "chart":
        return (
          <FrmPowerTrendPanel
            variant={v === "visual" ? "visual" : "standard"}
            chartWindow={chartWindow}
            onChartWindowChange={setChartWindow}
            showWindowPicker={false}
          />
        );
      case "fav":
        return (
          <div className="box-border flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
            {renderFavorites(v, !isDesktop)}
          </div>
        );
      case "session":
        return (
          <div className="box-border flex h-full min-h-0 w-full flex-1 flex-col overflow-auto">
            {renderSession(v)}
          </div>
        );
      case "hub":
        return renderHub(v);
      case "elevator":
        return renderElevator(v);
      case "sink":
        return renderSink(v, sinkExplorationHidden);
      case "drones":
        return renderDrones(v);
      case "mapmk":
        return renderMapMarkers(v);
      case "players":
        return renderPlayers(v);
      case "pwruse":
        return renderPowerUsage(v);
      case "gen":
        return renderGenerators(v);
      case "fabric":
        return renderFactoryList(v);
      case "ctrl":
        if (!me?.isAdmin) {
          return <p className="p-3 text-xs text-sf-muted">{t("dashboard.widgets.controlAdminOnly")}</p>;
        }
        return (
          <FrmDashboardControlWidget
            pins={controlPins}
            editMode={editMode}
            onAddPin={addControlPin}
            onRemovePin={removeControlPin}
          />
        );
      default:
        return <p className="p-3 text-sm text-sf-muted">{t("dashboard.widgets.unknown")}</p>;
    }
  };

  const widgetBodyFlexIds = new Set([
    "power",
    "session",
    "chart",
    "fav",
    "hub",
    "elevator",
    "sink",
    "drones",
    "mapmk",
    "players",
    "pwruse",
    "gen",
    "fabric",
    "ctrl",
  ]);

  const renderPanel = (id: string, { drag }: { drag: boolean }) => (
    <div key={id} className="sf-panel flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      {widgetHeader(id, drag)}
      <div
        className={
          widgetBodyFlexIds.has(id)
            ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            : "min-h-0 min-w-0 flex-1 overflow-auto"
        }
      >
        {renderWidgetBody(id)}
      </div>
    </div>
  );

  if (!layout) {
    return <FicsitPageLoader className="min-h-[min(70dvh,560px)] flex-1 border-0 bg-transparent" />;
  }

  return (
    <div className="w-full min-w-0 space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h1 className="sf-display text-lg font-semibold uppercase tracking-[0.12em] text-sf-orange sm:text-xl sm:tracking-[0.15em]">
            {t("dashboard.title")}
          </h1>
          <p className="text-xs text-sf-muted sm:text-sm">
            {t("dashboard.fresh")}: {powerQuery.dataUpdatedAt ? new Date(powerQuery.dataUpdatedAt).toLocaleTimeString() : "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saveHint ? <span className="text-xs text-sf-ok">{saveHint}</span> : null}
          {readOnlyDashboard ?
            <p className="text-xs text-sf-muted">{t("dashboard.readOnlyHint")}</p>
          : (
            <>
              <button
                type="button"
                className={`sf-btn min-h-10 text-xs ${editMode ? "border-sf-orange text-sf-orange" : ""}`}
                onClick={() => {
                  if (editMode) {
                    flushLayoutSave();
                    setCatalogOpen(false);
                  }
                  setEditMode((e) => !e);
                }}
              >
                {editMode ? t("dashboard.exitEdit") : t("dashboard.editLayout")}
              </button>
              {frmOk ?
                <div className="relative">
                  <button
                    type="button"
                    className="sf-btn min-h-10 text-xs"
                    onClick={() => setCatalogOpen((o) => !o)}
                    aria-expanded={catalogOpen}
                  >
                    {t("dashboard.widgets.catalog")}
                  </button>
                  {catalogOpen ?
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-40 cursor-default bg-transparent"
                        aria-label={t("dashboard.widgets.closeCatalog")}
                        onClick={() => setCatalogOpen(false)}
                      />
                      <div className="absolute right-0 top-full z-50 mt-1 min-w-[min(100vw-1rem,280px)] max-w-[min(100vw-1rem,320px)] border border-sf-border bg-[#1a1814] py-1 shadow-lg">
                        {!addableWidgets.length ?
                          <p className="px-3 py-2 text-xs text-sf-muted">{t("dashboard.widgets.allAdded")}</p>
                        : addableWidgets.map((w) => (
                            <button
                              key={w.id}
                              type="button"
                              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-sf-cream hover:bg-black/40"
                              onClick={() => addCatalogWidget(w.id)}
                            >
                              <ItemThumb className={w.artClassName} label="" size={36} />
                              <span className="min-w-0 flex-1 leading-snug">+ {t(w.titleKey)}</span>
                            </button>
                          ))
                        }
                      </div>
                    </>
                  : null}
                </div>
              : null}
            </>
          )}
        </div>
      </div>

      {!settings?.frmTokenConfigured ? (
        <div className="sf-panel p-3 text-sm text-sf-muted sm:p-4">{t("dashboard.frmMissing")}</div>
      ) : null}

      {layout.length === 0 ? (
        <div className="sf-panel w-full p-6 text-center">
          <p className="text-sm text-sf-muted">{t("dashboard.emptyWidgets")}</p>
          {frmOk && !readOnlyDashboard ?
            <button type="button" className="sf-btn mt-4 text-xs" onClick={() => setCatalogOpen(true)}>
              {t("dashboard.widgets.catalog")}
            </button>
          : null}
        </div>
      ) : !isDesktop ? (
        <div className="flex flex-col gap-3">
          {layoutSorted.map((item) => renderPanel(item.i, { drag: false }))}
        </div>
      ) : (
        <Grid
          className="min-h-[400px] w-full min-w-0"
          layout={layout}
          cols={12}
          rowHeight={32}
          margin={[10, 10]}
          containerPadding={[0, 0]}
          onLayoutChange={readOnlyDashboard ? undefined : onLayoutChange}
          draggableHandle=".drag-handle"
          isDraggable={editMode && !readOnlyDashboard}
          isResizable={editMode && !readOnlyDashboard}
        >
          {layout.map((item) => renderPanel(item.i, { drag: true }))}
        </Grid>
      )}
    </div>
  );
}

function CostProgressTable({
  rows,
  invByClass,
  lang,
  t,
  variant,
  omitDeliveredColumn,
}: {
  rows: CostLine[];
  invByClass: Map<string, number>;
  lang: string;
  t: (k: string) => string;
  variant: WidgetVariant;
  omitDeliveredColumn?: boolean;
}) {
  if (variant === "visual") {
    return (
      <CostProgressCards
        rows={rows}
        invByClass={invByClass}
        lang={lang}
        t={t}
        omitDeliveredColumn={omitDeliveredColumn}
      />
    );
  }
  const colCount = omitDeliveredColumn ? 4 : 5;
  return (
    <div className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-auto border border-sf-border">
      <table className="w-full min-w-0 max-w-full table-fixed border-collapse text-left text-[0.58rem] leading-tight sm:text-[0.65rem] md:text-xs">
        <colgroup>
          {omitDeliveredColumn ? (
            <>
              <col className="w-[34%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
            </>
          ) : (
            <>
              <col className="w-[30%]" />
              <col className="w-[17.5%]" />
              <col className="w-[17.5%]" />
              <col className="w-[17.5%]" />
              <col className="w-[17.5%]" />
            </>
          )}
        </colgroup>
        <thead className="sticky top-0 bg-[#14120f] text-sf-muted">
          <tr>
            <th className="truncate border-b border-sf-border p-1 font-normal sm:p-1.5">
              {t("dashboard.widgets.colItem")}
            </th>
            <th className="truncate border-b border-sf-border p-1 font-normal sm:p-1.5">
              {t("dashboard.widgets.colTarget")}
            </th>
            <th className="truncate border-b border-sf-border p-1 font-normal sm:p-1.5">
              {t("dashboard.widgets.colRemaining")}
            </th>
            {omitDeliveredColumn ? null : (
              <th className="truncate border-b border-sf-border p-1 font-normal sm:p-1.5">
                {t("dashboard.widgets.colDelivered")}
              </th>
            )}
            <th className="truncate border-b border-sf-border p-1 font-normal sm:p-1.5">
              {t("dashboard.widgets.colGlobal")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, idx) => {
            const cn = c.ClassName ?? `row-${idx}`;
            const total = Number(c.TotalCost);
            const rem = Number(c.RemainingCost);
            const target = Number.isFinite(total) ? total : Number(c.Amount) || 0;
            const remaining = Number.isFinite(rem) ? rem : target;
            const del = deliveredAmount(c);
            const g = invByClass.get(c.ClassName ?? "") ?? 0;
            const row: InventoryItemRow = {
              className: c.ClassName ?? "",
              name: c.Name ?? c.ClassName ?? "",
              amount: 0,
              favorite: false,
            };
            const dn = itemDisplayName(row, lang);
            const frac = deliveryProgressFraction(target, del);
            return (
              <Fragment key={`${cn}-${idx}`}>
                <tr className="border-b border-sf-border/40 hover:bg-black/20">
                  <td className="p-1 sm:p-1.5">
                    <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
                      <ItemThumb className={row.className} label={dn} size={22} />
                      <span className="min-w-0 truncate">{dn}</span>
                    </div>
                  </td>
                  <td className="truncate p-1 font-mono text-sf-muted sm:p-1.5">
                    {Number.isFinite(target) ? formatIntegerSpaces(Math.round(target)) : "—"}
                  </td>
                  <td className="truncate p-1 font-mono text-sf-orange sm:p-1.5">
                    {formatIntegerSpaces(Math.round(remaining))}
                  </td>
                  {omitDeliveredColumn ? null : (
                    <td className="truncate p-1 font-mono text-sf-ok sm:p-1.5">
                      {formatIntegerSpaces(Math.round(del))}
                    </td>
                  )}
                  <td className="truncate p-1 font-mono text-sf-cyan sm:p-1.5">
                    {formatIntegerSpaces(Math.round(g))}
                  </td>
                </tr>
                <tr className="border-b border-sf-border/60 hover:bg-black/20">
                  <td colSpan={colCount} className="min-w-0 max-w-full px-1 pb-0.5 pt-0 sm:px-1.5 sm:pb-1">
                    <ItemProgressBar fraction={frac} />
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CostProgressCards({
  rows,
  invByClass,
  lang,
  t,
  omitDeliveredColumn,
}: {
  rows: CostLine[];
  invByClass: Map<string, number>;
  lang: string;
  t: (k: string) => string;
  omitDeliveredColumn?: boolean;
}) {
  return (
    <div className="grid min-h-0 min-w-0 grid-cols-1 gap-2 overflow-auto sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-3">
      {rows.map((c, idx) => {
        const total = Number(c.TotalCost);
        const rem = Number(c.RemainingCost);
        const target = Number.isFinite(total) ? total : Number(c.Amount) || 0;
        const remaining = Number.isFinite(rem) ? rem : target;
        const del = deliveredAmount(c);
        const g = invByClass.get(c.ClassName ?? "") ?? 0;
        const row: InventoryItemRow = {
          className: c.ClassName ?? "",
          name: c.Name ?? c.ClassName ?? "",
          amount: 0,
          favorite: false,
        };
        const dn = itemDisplayName(row, lang);
        const key = `${c.ClassName ?? "row"}-${idx}`;
        const frac = deliveryProgressFraction(target, del);
        return (
          <div
            key={key}
            className="flex min-w-0 flex-col gap-2 rounded-lg border border-sf-border/80 bg-black/25 p-3 shadow-sm ring-1 ring-white/[0.04] sm:flex-row sm:items-start sm:gap-3"
          >
            <div className="mx-auto shrink-0 sm:mx-0">
              <ItemThumb className={row.className} label={dn} size={64} />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="line-clamp-2 text-sm font-medium text-sf-cream">{dn}</p>
              <dl
                className={
                  "mt-2 grid gap-x-2 gap-y-1 text-xs " +
                  (omitDeliveredColumn ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-2")
                }
              >
                <div>
                  <dt className="text-sf-muted">{t("dashboard.widgets.colTarget")}</dt>
                  <dd className="font-mono text-sf-muted">
                    {Number.isFinite(target) ? formatIntegerSpaces(Math.round(target)) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sf-muted">{t("dashboard.widgets.colRemaining")}</dt>
                  <dd className="font-mono text-sf-orange">{formatIntegerSpaces(Math.round(remaining))}</dd>
                </div>
                {omitDeliveredColumn ? null : (
                  <div>
                    <dt className="text-sf-muted">{t("dashboard.widgets.colDelivered")}</dt>
                    <dd className="font-mono text-sf-ok">{formatIntegerSpaces(Math.round(del))}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sf-muted">{t("dashboard.widgets.colGlobal")}</dt>
                  <dd className="font-mono text-sf-cyan">{formatIntegerSpaces(Math.round(g))}</dd>
                </div>
              </dl>
              <div className="mt-2 min-w-0">
                <ItemProgressBar fraction={frac} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatMini({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-sf-border/70 bg-black/20 px-3 py-2 shadow-sm ring-1 ring-white/[0.03] ${large ? "sm:px-4 sm:py-3" : "px-2 py-2"}`}
    >
      <p className={`uppercase tracking-wider text-sf-muted ${large ? "text-[0.65rem]" : "text-[0.6rem]"}`}>
        {label}
      </p>
      <p className={`mt-1 truncate text-sf-cream ${large ? "text-base sm:text-lg" : "text-sm"}`}>{value}</p>
    </div>
  );
}
