import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { FractionDonut } from "@/components/FractionDonut";
import { FrmIndustrialLever } from "@/components/FrmIndustrialLever";
import { ItemThumb } from "@/components/ItemThumb";
import { useOpenBuildingDetail } from "@/contexts/BuildingDetailModalContext";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import {
  buildingIdsInFavoriteGroups,
  readEnergyControlPrefs,
  subscribeEnergyPrefs,
  type FavoriteBuildingGroup,
} from "@/lib/energyControlPrefs";
import { rowSupportsSetEnabled } from "@/lib/frmBuildingPowerPolicy";
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
import { formatDecimalSpaces } from "@/lib/formatNumber";
import { normalizeBuildClassName, sumCircuitField } from "@/lib/monitoringFrm";
import {
  factoryBuildingClassForThumb,
  factoryPowerConsumedMw,
  sumFactoryRowsPowerMw,
} from "@/lib/productionFrm";

type Props = {
  variant: WidgetVariant;
};

type Card =
  | { kind: "switch"; id: string; row: Record<string, unknown> }
  | { kind: "building"; id: string; row: Record<string, unknown> }
  | {
      kind: "group";
      id: string;
      group: FavoriteBuildingGroup;
      members: { id: string; row: Record<string, unknown> }[];
    };

function rowForBuildingId(
  id: string,
  factories: Record<string, unknown>[],
  generators: Record<string, unknown>[],
): Record<string, unknown> | undefined {
  const fac = factories.find((r) => String(r.ID ?? r.Id ?? "") === id);
  if (fac) return fac;
  return generators.find((r) => String(r.ID ?? r.Id ?? r.id ?? "") === id);
}

function rowConsumedMw(r: Record<string, unknown>): number {
  return factoryPowerConsumedMw(r);
}

function ControlPowerBlock({
  mw,
  pctOfGrid,
  gridTotalMw,
  donutSize,
  visual,
}: {
  mw: number;
  pctOfGrid: number | null;
  gridTotalMw: number;
  donutSize: number;
  visual: boolean;
}) {
  const { t } = useTranslation();
  const frac = pctOfGrid != null && gridTotalMw > 0 ? Math.min(1, (pctOfGrid as number) / 100) : 0;
  const hasPct = pctOfGrid != null && gridTotalMw > 0;

  if (visual) {
    return (
      <div className="mt-auto w-full border-t border-sf-border/50 pt-2">
        <div className="flex items-center justify-center gap-1.5 text-sf-cyan">
          <span className="sf-display text-base font-semibold tabular-nums sm:text-lg">
            {formatDecimalSpaces(mw, 2)}
          </span>
          <span className="text-[0.55rem] font-normal text-sf-muted">MW</span>
        </div>
        <div className="mt-2 flex flex-col items-center gap-1">
          {hasPct ?
            <>
              <FractionDonut fraction={frac} size={donutSize} variant="consumption" showCenterLabel={donutSize >= 26} />
              <span className="text-center text-[0.55rem] leading-tight text-sf-muted">{t("dashboard.widgets.controlOfGrid")}</span>
            </>
          : <span className="text-[0.65rem] text-sf-muted">—</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <span className="font-mono text-[0.65rem] tabular-nums text-sf-orange sm:text-xs">
        {formatDecimalSpaces(mw, 2)} MW
      </span>
      {hasPct ?
        <FractionDonut fraction={frac} size={donutSize} variant="consumption" showCenterLabel={donutSize >= 26} />
      : <span className="text-[0.6rem] text-sf-muted">—</span>}
    </div>
  );
}

export function FrmDashboardControlWidget({ variant }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const openBuildingDetail = useOpenBuildingDetail();
  const prefs = useSyncExternalStore(subscribeEnergyPrefs, readEnergyControlPrefs, readEnergyControlPrefs);
  const refetchMs = useFrmRefetchMs();

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
    const inAnyGroup = buildingIdsInFavoriteGroups();
    const out: Card[] = [];
    for (const id of prefs.favoriteSwitchIds) {
      const row = switches.find((s) => switchRowId(s) === id);
      if (row) out.push({ kind: "switch", id, row });
    }
    for (const gid of prefs.favoriteBuildingGroupIds) {
      const group = prefs.favoriteBuildingGroups.find((g) => g.id === gid);
      if (!group) continue;
      const members: { id: string; row: Record<string, unknown> }[] = [];
      for (const mid of group.memberBuildingIds) {
        const row = rowForBuildingId(mid, factories, generators);
        if (row) members.push({ id: mid, row });
      }
      out.push({ kind: "group", id: gid, group, members });
    }
    for (const id of prefs.favoriteBuildingIds) {
      if (inAnyGroup.has(id)) continue;
      const fac = factories.find((r) => String(r.ID ?? r.Id ?? "") === id);
      if (fac) {
        out.push({ kind: "building", id, row: fac });
        continue;
      }
      const gen = generators.find((r) => String(r.ID ?? r.Id ?? r.id ?? "") === id);
      if (gen) out.push({ kind: "building", id, row: gen });
    }
    return out;
  }, [
    prefs.favoriteSwitchIds,
    prefs.favoriteBuildingIds,
    prefs.favoriteBuildingGroupIds,
    prefs.favoriteBuildingGroups,
    switches,
    factories,
    generators,
  ]);

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

  const listUl =
    "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden p-2 sm:p-3";
  const cardUl =
    "grid min-h-0 w-full min-w-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2 overflow-y-auto overflow-x-hidden p-2 sm:gap-3 sm:p-3 md:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]";

  const pctForMw = (mw: number) => (gridTotalMw > 1e-9 ? (mw / gridTotalMw) * 100 : null);

  const renderSwitch = (id: string, r: Record<string, unknown>, visual: boolean, thumb: number) => {
    const cls = String(r.ClassName ?? r.className ?? "Build_PowerSwitch_C").trim();
    const aliasSw = prefs.switchAliases[id]?.trim();
    const title = aliasSw || frmgClassLabel(cls, i18n.language);
    const on = switchRowIsOn(r);
    const busy = swMut.isPending && swMut.variables?.id === id;
    const mw = rowConsumedMw(r);
    const pctOfGrid = pctForMw(mw);
    if (visual) {
      return (
        <li
          key={`sw-${id}`}
          className="flex min-h-[148px] min-w-0 flex-col items-center gap-2 rounded-lg border border-sf-border/80 bg-black/25 p-2 text-center shadow-sm ring-1 ring-white/[0.04] sm:min-h-0 sm:p-3"
        >
          <button
            type="button"
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-transparent transition-colors hover:border-sf-orange/30 hover:bg-white/[0.03]"
            onClick={() => openBuildingDetail(r, { showMap: false, showAdminControls: Boolean(me?.isAdmin) })}
          >
            <div className="flex w-full shrink-0 justify-center">
              <ItemThumb className={cls} label="" size={thumb} />
            </div>
            <span className="line-clamp-3 min-h-0 w-full text-[0.7rem] leading-snug text-sf-cream sm:text-xs">{title}</span>
          </button>
          <p className="text-[0.58rem] uppercase tracking-wider text-sf-muted">{t("dashboard.widgets.controlKindSwitch")}</p>
          <ControlPowerBlock mw={mw} pctOfGrid={pctOfGrid} gridTotalMw={gridTotalMw} donutSize={52} visual />
          <div className="mt-1 flex w-full justify-center">
            <FrmIndustrialLever on={on} busy={busy} onToggle={() => swMut.mutate({ id, status: !on })} />
          </div>
        </li>
      );
    }
    return (
      <li
        key={`sw-${id}`}
        className="flex min-h-0 w-full min-w-0 items-center gap-1.5 rounded-lg border border-sf-border/80 bg-black/20 px-2 py-1.5 shadow-sm ring-1 ring-white/[0.03] sm:gap-2 sm:px-2.5 sm:py-2"
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-transparent text-left transition-colors hover:border-sf-orange/25 hover:bg-white/[0.03] sm:gap-2"
          onClick={() => openBuildingDetail(r, { showMap: false, showAdminControls: Boolean(me?.isAdmin) })}
        >
          <ItemThumb className={cls} label="" size={thumb} />
          <div className="min-w-0">
            <span className="block truncate text-[0.7rem] text-sf-text sm:text-xs">{title}</span>
            <span className="block text-[0.58rem] uppercase tracking-wider text-sf-muted">
              {t("dashboard.widgets.controlKindSwitch")}
            </span>
          </div>
        </button>
        <ControlPowerBlock mw={mw} pctOfGrid={pctOfGrid} gridTotalMw={gridTotalMw} donutSize={34} visual={false} />
        <FrmIndustrialLever on={on} busy={busy} onToggle={() => swMut.mutate({ id, status: !on })} />
      </li>
    );
  };

  const renderBuilding = (id: string, r: Record<string, unknown>, visual: boolean, thumb: number) => {
    const raw = String(r.ClassName ?? r.className ?? "").trim();
    const norm = raw ? normalizeBuildClassName(raw) : "—";
    const img = norm !== "—" ? norm : factoryBuildingClassForThumb(r);
    const aliasB = prefs.buildingAliases[id]?.trim();
    const title = aliasB || frmgClassLabel(img, i18n.language);
    const on = readCachedBuildingEnabled(id) ?? true;
    const busy = enMut.isPending && enMut.variables?.id === id;
    const mw = rowConsumedMw(r);
    const pctOfGrid = pctForMw(mw);
    if (visual) {
      return (
        <li
          key={`b-${id}`}
          className="flex min-h-[148px] min-w-0 flex-col items-center gap-2 rounded-lg border border-sf-border/80 bg-black/25 p-2 text-center shadow-sm ring-1 ring-white/[0.04] sm:min-h-0 sm:p-3"
        >
          <button
            type="button"
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-transparent transition-colors hover:border-sf-orange/30 hover:bg-white/[0.03]"
            onClick={() => openBuildingDetail(r, { showMap: true, showAdminControls: Boolean(me?.isAdmin) })}
          >
            <div className="flex w-full shrink-0 justify-center">
              <ItemThumb className={img} label="" size={thumb} />
            </div>
            <span className="line-clamp-3 min-h-0 w-full text-[0.7rem] leading-snug text-sf-cream sm:text-xs">{title}</span>
          </button>
          <p className="text-[0.58rem] uppercase tracking-wider text-sf-muted">{t("dashboard.widgets.controlKindBuilding")}</p>
          <ControlPowerBlock mw={mw} pctOfGrid={pctOfGrid} gridTotalMw={gridTotalMw} donutSize={52} visual />
          <div className="mt-1 flex w-full justify-center">
            <FrmIndustrialLever on={on} busy={busy} onToggle={() => enMut.mutate({ id, status: !on })} />
          </div>
        </li>
      );
    }
    return (
      <li
        key={`b-${id}`}
        className="flex min-h-0 w-full min-w-0 items-center gap-1.5 rounded-lg border border-sf-border/80 bg-black/20 px-2 py-1.5 shadow-sm ring-1 ring-white/[0.03] sm:gap-2 sm:px-2.5 sm:py-2"
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-transparent text-left transition-colors hover:border-sf-orange/25 hover:bg-white/[0.03] sm:gap-2"
          onClick={() => openBuildingDetail(r, { showMap: true, showAdminControls: Boolean(me?.isAdmin) })}
        >
          <ItemThumb className={img} label="" size={thumb} />
          <div className="min-w-0">
            <span className="block truncate text-[0.7rem] text-sf-text sm:text-xs">{title}</span>
            <span className="block text-[0.58rem] uppercase tracking-wider text-sf-muted">
              {t("dashboard.widgets.controlKindBuilding")}
            </span>
          </div>
        </button>
        <ControlPowerBlock mw={mw} pctOfGrid={pctOfGrid} gridTotalMw={gridTotalMw} donutSize={34} visual={false} />
        <FrmIndustrialLever on={on} busy={busy} onToggle={() => enMut.mutate({ id, status: !on })} />
      </li>
    );
  };

  const renderGroup = (c: Extract<Card, { kind: "group" }>, visual: boolean, thumb: number) => {
    const { group, members } = c;
    const rows = members.map((m) => m.row);
    const mw = sumFactoryRowsPowerMw(rows);
    const pctOfGrid = pctForMw(mw);
    const buildingCount = group.memberBuildingIds.length;

    if (visual) {
      return (
        <li
          key={`grp-${group.id}`}
          className="flex min-h-[148px] min-w-0 flex-col items-center gap-2 rounded-lg border border-sf-border/80 bg-black/25 p-2 text-center shadow-sm ring-1 ring-white/[0.04] sm:min-h-0 sm:p-3"
        >
          <div className="flex w-full flex-col items-center gap-2">
            <div className="flex w-full shrink-0 justify-center">
              <ItemThumb className={group.thumbClass} label="" size={thumb} />
            </div>
            <span className="line-clamp-3 min-h-0 w-full text-[0.7rem] font-semibold leading-snug text-sf-cream sm:text-xs">{group.name}</span>
            <p className="text-[0.58rem] uppercase tracking-wider text-sf-muted">
              {t("dashboard.widgets.controlKindGroup")} · {t("dashboard.widgets.controlGroupBuildingCount", { count: buildingCount })}
            </p>
          </div>
          <ControlPowerBlock mw={mw} pctOfGrid={pctOfGrid} gridTotalMw={gridTotalMw} donutSize={52} visual />
          {members.length ?
            <ul className="mt-1 w-full space-y-1 border-t border-sf-border/40 pt-2 text-left">
              {members.map(({ id: mid, row: mr }) => {
                const rawM = String(mr.ClassName ?? mr.className ?? "").trim();
                const normM = rawM ? normalizeBuildClassName(rawM) : "—";
                const imgM = normM !== "—" ? normM : factoryBuildingClassForThumb(mr);
                const aliasM = prefs.buildingAliases[mid]?.trim();
                const titleM = aliasM || frmgClassLabel(imgM, i18n.language);
                const onM = readCachedBuildingEnabled(mid) ?? true;
                const busyM = enMut.isPending && enMut.variables?.id === mid;
                const canPow = rowSupportsSetEnabled(mr);
                return (
                  <li
                    key={`${group.id}-${mid}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-sf-border/35 bg-black/20 px-1.5 py-1"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() =>
                        openBuildingDetail(mr, { showMap: true, showAdminControls: Boolean(me?.isAdmin) })
                      }
                    >
                      <ItemThumb className={imgM} label="" size={26} />
                      <span className="truncate text-[0.65rem] text-sf-cream">{titleM}</span>
                    </button>
                    {canPow ?
                      <FrmIndustrialLever
                        on={onM}
                        busy={busyM}
                        onToggle={() => enMut.mutate({ id: mid, status: !onM })}
                      />
                    : null}
                  </li>
                );
              })}
            </ul>
          : null}
        </li>
      );
    }

    return (
      <li
        key={`grp-${group.id}`}
        className="rounded-lg border border-sf-border/80 bg-black/20 px-2 py-2 shadow-sm ring-1 ring-white/[0.03] sm:px-2.5 sm:py-2"
      >
        <div className="flex min-h-0 w-full items-center gap-2">
          <ItemThumb className={group.thumbClass} label="" size={thumb} />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[0.7rem] font-medium text-sf-text sm:text-xs">{group.name}</span>
            <span className="block text-[0.58rem] text-sf-muted">
              {t("dashboard.widgets.controlKindGroup")} · {t("dashboard.widgets.controlGroupBuildingCount", { count: buildingCount })}
            </span>
          </div>
          <ControlPowerBlock mw={mw} pctOfGrid={pctOfGrid} gridTotalMw={gridTotalMw} donutSize={34} visual={false} />
        </div>
        {members.length ?
          <ul className="mt-2 space-y-1 border-t border-sf-border/40 pt-2">
            {members.map(({ id: mid, row: mr }) => {
              const rawM = String(mr.ClassName ?? mr.className ?? "").trim();
              const normM = rawM ? normalizeBuildClassName(rawM) : "—";
              const imgM = normM !== "—" ? normM : factoryBuildingClassForThumb(mr);
              const aliasM = prefs.buildingAliases[mid]?.trim();
              const titleM = aliasM || frmgClassLabel(imgM, i18n.language);
              const onM = readCachedBuildingEnabled(mid) ?? true;
              const busyM = enMut.isPending && enMut.variables?.id === mid;
              const canPow = rowSupportsSetEnabled(mr);
              return (
                <li
                  key={`${group.id}-${mid}`}
                  className="flex items-center justify-between gap-2 rounded-md bg-black/15 px-1 py-0.5"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    onClick={() =>
                      openBuildingDetail(mr, { showMap: true, showAdminControls: Boolean(me?.isAdmin) })
                    }
                  >
                    <ItemThumb className={imgM} label="" size={22} />
                    <span className="truncate text-[0.65rem] text-sf-cream">{titleM}</span>
                  </button>
                  {canPow ?
                    <FrmIndustrialLever
                      on={onM}
                      busy={busyM}
                      onToggle={() => enMut.mutate({ id: mid, status: !onM })}
                    />
                  : null}
                </li>
              );
            })}
          </ul>
        : null}
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

  const visual = variant === "visual";
  const thumb = visual ? 48 : 22;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {visual ?
        <ul className={cardUl}>
          {cards.map((c) => {
            if (c.kind === "switch") return renderSwitch(c.id, c.row, true, thumb);
            if (c.kind === "building") return renderBuilding(c.id, c.row, true, thumb);
            return renderGroup(c, true, thumb);
          })}
        </ul>
      : <ul className={listUl}>
          {cards.map((c) => {
            if (c.kind === "switch") return renderSwitch(c.id, c.row, false, thumb);
            if (c.kind === "building") return renderBuilding(c.id, c.row, false, thumb);
            return renderGroup(c, false, thumb);
          })}
        </ul>
      }
    </div>
  );
}
