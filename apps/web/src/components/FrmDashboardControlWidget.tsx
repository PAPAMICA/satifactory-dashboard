import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { FrmIndustrialLever } from "@/components/FrmIndustrialLever";
import { FrmWorldMapDeck } from "@/components/FrmWorldMapDeck";
import { ItemThumb } from "@/components/ItemThumb";
import { useOpenBuildingDetail } from "@/contexts/BuildingDetailModalContext";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import {
  readEnergyControlPrefs,
  subscribeEnergyPrefs,
  toggleFavoriteBuilding,
  toggleFavoriteSwitch,
} from "@/lib/energyControlPrefs";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";
import {
  cacheBuildingEnabled,
  parseSetEnabledStatus,
  postSetEnabled,
  postSetSwitches,
  readCachedBuildingEnabled,
  switchRowId,
  switchRowIsOn,
} from "@/lib/frmControl";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import type { WidgetVariant } from "@/lib/dashboardWidgetCatalog";
import { emptyFrmMapOverlays } from "@/lib/frmMapOverlays";
import { frmMarkerMapPosition } from "@/lib/frmMapWorld";
import { formatDecimalSpaces } from "@/lib/formatNumber";
import { normalizeBuildClassName, sumCircuitField } from "@/lib/monitoringFrm";
import {
  factoryBuildingClassForThumb,
  factoryPowerConsumedMw,
} from "@/lib/productionFrm";

type Props = {
  editMode: boolean;
  variant: WidgetVariant;
};

type Card =
  | { kind: "switch"; id: string; row: Record<string, unknown> }
  | { kind: "building"; id: string; row: Record<string, unknown> };

function isPowerSwitchRow(r: Record<string, unknown>): boolean {
  return /Build_(Priority)?PowerSwitch/i.test(String(r.ClassName ?? r.className ?? ""));
}

function rowConsumedMw(r: Record<string, unknown>): number {
  return factoryPowerConsumedMw(r);
}

function MwShareBar({ pct }: { pct: number }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/50 ring-1 ring-sf-border/35">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sf-cyan/75 via-sf-cyan/50 to-sf-orange/85 transition-[width] duration-300"
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

function PowerMwLine({ mw, pctOfGrid, gridTotalMw }: { mw: number; pctOfGrid: number | null; gridTotalMw: number }) {
  const { t } = useTranslation();
  return (
    <div className="mt-1 space-y-0.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="font-mono text-[0.72rem] tabular-nums text-sf-orange sm:text-xs">
          {formatDecimalSpaces(mw, 2)} MW
        </span>
        {pctOfGrid != null && gridTotalMw > 0 ?
          <span className="text-[0.65rem] tabular-nums text-sf-muted">
            {formatDecimalSpaces(pctOfGrid, 1)}%{" "}
            <span className="font-normal text-sf-muted/80">{t("dashboard.widgets.controlOfGrid")}</span>
          </span>
        : <span className="text-[0.65rem] text-sf-muted">—</span>}
      </div>
      {pctOfGrid != null && gridTotalMw > 0 ? <MwShareBar pct={pctOfGrid} /> : null}
    </div>
  );
}

export function FrmDashboardControlWidget({ editMode, variant }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const openBuildingDetail = useOpenBuildingDetail();
  const prefs = useSyncExternalStore(subscribeEnergyPrefs, readEnergyControlPrefs, readEnergyControlPrefs);
  const refetchMs = useFrmRefetchMs();
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);
  const emptyOverlays = useMemo(() => emptyFrmMapOverlays(), []);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ isAdmin?: boolean }>("/api/me"),
    staleTime: 60_000,
  });

  const powerQ = useQuery({
    queryKey: ["frm", "getPower"],
    queryFn: () => apiFetch<unknown>("/api/frm/getPower"),
    refetchInterval: refetchMs,
    refetchIntervalInBackground: true,
    staleTime: 0,
    enabled: refetchMs !== false,
  });

  const swQ = useQuery({
    queryKey: ["frm", "getSwitches"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getSwitches")),
    refetchInterval: refetchMs,
  });
  const facQ = useQuery({
    queryKey: ["frm", "getFactory"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getFactory")),
    refetchInterval: refetchMs,
  });
  const genQ = useQuery({
    queryKey: ["frm", "getGenerators"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getGenerators")),
    refetchInterval: refetchMs,
  });
  const switches = asFrmRowArray(swQ.data);
  const factories = asFrmRowArray(facQ.data);
  const generators = asFrmRowArray(genQ.data);
  const circuits = useMemo(() => asFrmRowArray(powerQ.data), [powerQ.data]);
  const gridTotalMw = useMemo(() => sumCircuitField(circuits, "PowerConsumed"), [circuits]);

  const cards: Card[] = useMemo(() => {
    const out: Card[] = [];
    for (const id of prefs.favoriteSwitchIds) {
      const row = switches.find((s) => switchRowId(s) === id);
      if (row) out.push({ kind: "switch", id, row });
    }
    for (const id of prefs.favoriteBuildingIds) {
      const fac = factories.find((r) => String(r.ID ?? r.Id ?? "") === id);
      if (fac) {
        out.push({ kind: "building", id, row: fac });
        continue;
      }
      const gen = generators.find((r) => String(r.ID ?? r.Id ?? r.id ?? "") === id);
      if (gen) out.push({ kind: "building", id, row: gen });
    }
    return out;
  }, [prefs.favoriteSwitchIds, prefs.favoriteBuildingIds, switches, factories, generators]);

  const mapMarkers = useMemo(() => cards.map((c) => c.row).filter((r) => frmMarkerMapPosition(r) != null), [cards]);

  const mapAutoFitToken = useMemo(() => {
    return mapMarkers
      .map((r) => {
        const p = frmMarkerMapPosition(r);
        const id = String(r.ID ?? r.Id ?? "");
        return p ? `${id}:${p[0].toFixed(0)}:${p[1].toFixed(0)}` : "";
      })
      .join("|");
  }, [mapMarkers]);

  const onMapSelectMarker = useCallback(
    (row: Record<string, unknown> | null) => {
      if (!row) {
        setMapSelectedId(null);
        return;
      }
      const id = String(row.ID ?? row.Id ?? "");
      setMapSelectedId(id || null);
      const sw = isPowerSwitchRow(row);
      openBuildingDetail(row, { showMap: !sw, showAdminControls: Boolean(me?.isAdmin) });
    },
    [me?.isAdmin, openBuildingDetail],
  );

  const swMut = useMutation({
    mutationFn: (p: { id: string; status: boolean }) => postSetSwitches({ ID: p.id, status: p.status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["frm", "getSwitches"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getPower"] });
    },
  });
  const enMut = useMutation({
    mutationFn: (p: { id: string; status: boolean }) => postSetEnabled({ ID: p.id, status: p.status }),
    onSuccess: (data, vars) => {
      const p = parseSetEnabledStatus(data);
      cacheBuildingEnabled(vars.id, p ?? vars.status);
      void qc.invalidateQueries({ queryKey: ["frm", "getFactory"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getGenerators"] });
    },
  });

  const renderCard = (c: Card, layout: "list" | "mapRail") => {
    const id = c.id;
    const rail = layout === "mapRail";
    if (c.kind === "switch") {
      const r = c.row;
      const cls = String(r.ClassName ?? r.className ?? "Build_PowerSwitch_C").trim();
      const aliasSw = prefs.switchAliases[id]?.trim();
      const title = aliasSw || frmgClassLabel(cls, i18n.language);
      const on = switchRowIsOn(r);
      const busy = swMut.isPending && swMut.variables?.id === id;
      const mw = rowConsumedMw(r);
      const pctOfGrid = gridTotalMw > 1e-9 ? (mw / gridTotalMw) * 100 : null;
      return (
        <li
          key={`sw-${id}`}
          className={
            rail ?
              "flex flex-col gap-2 rounded-xl border border-sf-border/60 bg-gradient-to-b from-black/40 to-[#100e0c] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/35"
            : "flex flex-col gap-2 rounded-xl border border-sf-border/70 bg-gradient-to-b from-black/35 to-[#0f0e0c] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/30 sm:flex-row sm:items-stretch sm:justify-between sm:gap-3 sm:p-3"
          }
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg border border-transparent text-left transition-colors hover:border-sf-orange/25 hover:bg-white/[0.03]"
            onClick={() => openBuildingDetail(r, { showMap: false, showAdminControls: Boolean(me?.isAdmin) })}
          >
            <ItemThumb className={cls} label="" size={rail ? 36 : 40} />
            <div className="min-w-0 flex-1">
              <p className={`truncate font-semibold text-sf-cream ${rail ? "text-xs" : "text-sm"}`}>{title}</p>
              <p className="mt-0.5 text-[0.6rem] uppercase tracking-wider text-sf-muted/90">
                {t("dashboard.widgets.controlKindSwitch")}
              </p>
              <PowerMwLine mw={mw} pctOfGrid={pctOfGrid} gridTotalMw={gridTotalMw} />
            </div>
          </button>
          <div className={`flex shrink-0 items-center justify-between gap-2 ${rail ? "flex-row" : "sm:flex-col sm:items-end"}`}>
            <FrmIndustrialLever compact showLabels={false} on={on} busy={busy} onToggle={() => swMut.mutate({ id, status: !on })} />
            {editMode ?
              <button
                type="button"
                className="text-[0.6rem] uppercase tracking-wider text-sf-danger hover:underline"
                onClick={() => toggleFavoriteSwitch(id)}
              >
                {t("dashboard.widgets.controlUnfavorite")}
              </button>
            : null}
          </div>
        </li>
      );
    }
    const r = c.row;
    const raw = String(r.ClassName ?? r.className ?? "").trim();
    const norm = raw ? normalizeBuildClassName(raw) : "—";
    const img = norm !== "—" ? norm : factoryBuildingClassForThumb(r);
    const aliasB = prefs.buildingAliases[id]?.trim();
    const title = aliasB || frmgClassLabel(img, i18n.language);
    const on = readCachedBuildingEnabled(id) ?? true;
    const busy = enMut.isPending && enMut.variables?.id === id;
    const mw = rowConsumedMw(r);
    const pctOfGrid = gridTotalMw > 1e-9 ? (mw / gridTotalMw) * 100 : null;
    return (
      <li
        key={`b-${id}`}
        className={
          rail ?
            "flex flex-col gap-2 rounded-xl border border-sf-border/60 bg-gradient-to-b from-black/40 to-[#100e0c] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/35"
          : "flex flex-col gap-2 rounded-xl border border-sf-border/70 bg-gradient-to-b from-black/35 to-[#0f0e0c] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/30 sm:flex-row sm:items-stretch sm:justify-between sm:gap-3 sm:p-3"
        }
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg border border-transparent text-left transition-colors hover:border-sf-orange/25 hover:bg-white/[0.03]"
          onClick={() => openBuildingDetail(r, { showMap: true, showAdminControls: Boolean(me?.isAdmin) })}
        >
          <ItemThumb className={img} label="" size={rail ? 36 : 40} />
          <div className="min-w-0 flex-1">
            <p className={`truncate font-semibold text-sf-cream ${rail ? "text-xs" : "text-sm"}`}>{title}</p>
            <p className="mt-0.5 text-[0.6rem] uppercase tracking-wider text-sf-muted/90">
              {t("dashboard.widgets.controlKindBuilding")}
            </p>
            <PowerMwLine mw={mw} pctOfGrid={pctOfGrid} gridTotalMw={gridTotalMw} />
          </div>
        </button>
        <div className={`flex shrink-0 items-center justify-between gap-2 ${rail ? "flex-row" : "sm:flex-col sm:items-end"}`}>
          <FrmIndustrialLever compact showLabels={false} on={on} busy={busy} onToggle={() => enMut.mutate({ id, status: !on })} />
          {editMode ?
            <button
              type="button"
              className="text-[0.6rem] uppercase tracking-wider text-sf-danger hover:underline"
              onClick={() => toggleFavoriteBuilding(id)}
            >
              {t("dashboard.widgets.controlUnfavorite")}
            </button>
          : null}
        </div>
      </li>
    );
  };

  if (!cards.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-xs text-sf-muted">{t("dashboard.widgets.controlEmptyFavorites")}</p>
        <p className="text-[0.65rem] text-sf-muted/80">{t("dashboard.widgets.controlEmptyFavoritesHint")}</p>
      </div>
    );
  }

  const listBlock = (
    <ul
      className={
        variant === "visual" ?
          "flex max-h-[min(42vh,320px)] min-h-0 flex-col gap-2 overflow-y-auto pr-0.5 lg:max-h-none lg:w-[min(100%,300px)] lg:shrink-0"
        : "flex h-full min-h-0 flex-col gap-2.5 overflow-y-auto p-2 sm:gap-3 sm:p-3"
      }
    >
      {cards.map((c) => renderCard(c, variant === "visual" ? "mapRail" : "list"))}
    </ul>
  );

  if (variant === "standard") {
    return listBlock;
  }

  /* Carte : repères favoris uniquement, bandeau réseau, liste à droite (desktop) ou sous la carte (mobile). */
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 sm:gap-3 sm:p-3 lg:flex-row lg:items-stretch">
      <div className="flex min-h-0 min-w-0 flex-[1.15] flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sf-border/50 bg-black/25 px-2.5 py-1.5 ring-1 ring-white/[0.03]">
          <span className="text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
            {t("dashboard.widgets.controlGridLoad")}
          </span>
          <span className="font-mono text-xs tabular-nums text-sf-cream">
            {formatDecimalSpaces(gridTotalMw, 1)} MW
          </span>
        </div>
        <div className="relative min-h-[min(36vh,260px)] flex-1 overflow-hidden rounded-xl border border-sf-border/60 bg-[#0a0c10] shadow-inner ring-1 ring-black/40">
          {mapMarkers.length ?
            <FrmWorldMapDeck
              markers={mapMarkers}
              autoFitToken={mapAutoFitToken}
              scrollWheelZoom={false}
              className="min-h-0 flex-1 rounded-lg"
              selectedId={mapSelectedId}
              onSelectMarker={onMapSelectMarker}
              worldOverlays={emptyOverlays}
              layerVisibility={{
                buildingStorage: false,
                buildingPower: false,
                buildingProduction: false,
                cables: false,
                pipes: false,
                belts: false,
              }}
            />
          : <div className="flex h-full min-h-[180px] items-center justify-center px-4 text-center text-xs text-sf-muted">
              {t("dashboard.widgets.controlMapNoCoords")}
            </div>
          }
        </div>
      </div>
      {listBlock}
    </div>
  );
}
