import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ControlFavoriteGroupsBulkPanel } from "@/components/ControlFavoriteGroupsBulkPanel";
import { ControlFavoritesSettingsModal } from "@/components/ControlFavoritesSettingsModal";
import { FicsitPageLoader } from "@/components/FicsitPageLoader";
import { FrmSwitchesPanel } from "@/components/FrmSwitchesPanel";
import { MonitoringGate } from "@/components/MonitoringGate";
import { ItemThumb } from "@/components/ItemThumb";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";
import {
  cacheBuildingEnabled,
  parseSetEnabledStatus,
  postSetEnabled,
  readCachedBuildingEnabled,
} from "@/lib/frmControl";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import { factoryBuildingPrimarySecondary } from "@/components/ProductionBuildingModal";
import { factoryBuildingClassForThumb } from "@/lib/productionFrm";
import { normalizeBuildClassName } from "@/lib/monitoringFrm";
import { FrmIndustrialLever } from "@/components/FrmIndustrialLever";
import { useOpenBuildingDetail } from "@/contexts/BuildingDetailModalContext";
import { rowSupportsSetEnabled } from "@/lib/frmBuildingPowerPolicy";

function useSetEnabledMut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { ID: string; status: boolean }) => postSetEnabled(p),
    onSuccess: (data, vars) => {
      const parsed = parseSetEnabledStatus(data);
      cacheBuildingEnabled(vars.ID, parsed ?? vars.status);
      void qc.invalidateQueries({ queryKey: ["frm", "getFactory"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getGenerators"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getPower"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getPowerUsage"] });
    },
  });
}

function FactoryEnableRow({
  row,
  lang,
  mut,
  isAdmin,
}: {
  row: Record<string, unknown>;
  lang: string;
  mut: ReturnType<typeof useSetEnabledMut>;
  isAdmin: boolean;
}) {
  const openBuildingDetail = useOpenBuildingDetail();
  const id = String(row.ID ?? row.Id ?? "").trim();
  const thumb = factoryBuildingClassForThumb(row);
  const { primary } = factoryBuildingPrimarySecondary(row, lang);
  const cached = readCachedBuildingEnabled(id);
  const [local, setLocal] = useState<boolean | null>(cached ?? null);
  const guess = local ?? true;
  const busy = mut.isPending && mut.variables?.ID === id;
  const canPower = rowSupportsSetEnabled(row);

  if (!id) return null;

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-sf-border/60 bg-black/25 p-3 ring-1 ring-white/[0.03] sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-transparent text-left transition-colors hover:border-sf-orange/30 hover:bg-white/[0.04]"
        onClick={() => openBuildingDetail(row, { showMap: true, showAdminControls: isAdmin })}
      >
        <ItemThumb className={thumb} label="" size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-sf-cream">{primary}</p>
        </div>
      </button>
      {canPower ?
        <div className="flex shrink-0 items-center gap-2">
          <FrmIndustrialLever
            on={guess}
            busy={busy}
            onToggle={() => {
              const next = !guess;
              mut.mutate(
                { ID: id, status: next },
                {
                  onSuccess: (data) => {
                    const p = parseSetEnabledStatus(data);
                    setLocal(p ?? next);
                  },
                },
              );
            }}
          />
        </div>
      : null}
    </li>
  );
}

function GeneratorEnableRow({
  row,
  lang,
  mut,
  isAdmin,
}: {
  row: Record<string, unknown>;
  lang: string;
  mut: ReturnType<typeof useSetEnabledMut>;
  isAdmin: boolean;
}) {
  const openBuildingDetail = useOpenBuildingDetail();
  const idRaw = row.ID ?? row.Id ?? row.id;
  const id = String(idRaw ?? "").trim();
  const rawClass = String(row.ClassName ?? row.className ?? "").trim();
  const thumb = rawClass ? normalizeBuildClassName(rawClass) : "Build_GeneratorCoal_C";
  const imgClass = thumb !== "—" ? thumb : "Build_GeneratorCoal_C";
  const { primary: genPrimary } = factoryBuildingPrimarySecondary(row, lang);
  const cached = id ? readCachedBuildingEnabled(id) : undefined;
  const [local, setLocal] = useState<boolean | null>(cached ?? null);
  const guess = local ?? true;
  const busy = mut.isPending && mut.variables?.ID === id;
  const canPower = rowSupportsSetEnabled(row);

  if (!id) return null;

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-sf-border/60 bg-black/25 p-3 ring-1 ring-white/[0.03] sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-transparent text-left transition-colors hover:border-sf-orange/30 hover:bg-white/[0.04]"
        onClick={() => openBuildingDetail(row, { showMap: true, showAdminControls: isAdmin })}
      >
        <ItemThumb className={imgClass} label="" size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-sf-cream">{genPrimary}</p>
        </div>
      </button>
      {canPower ?
        <div className="flex shrink-0 items-center gap-2">
          <FrmIndustrialLever
            on={guess}
            busy={busy}
            onToggle={() => {
              const next = !guess;
              mut.mutate(
                { ID: id, status: next },
                {
                  onSuccess: (data) => {
                    const p = parseSetEnabledStatus(data);
                    setLocal(p ?? next);
                  },
                },
              );
            }}
          />
        </div>
      : null}
    </li>
  );
}

function ControlPageBody() {
  const { t, i18n } = useTranslation();
  const refetchMs = useFrmRefetchMs();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ isAdmin?: boolean }>("/api/me"),
    staleTime: 60_000,
  });
  const isAdmin = Boolean(me?.isAdmin);
  const [favoritesSettingsOpen, setFavoritesSettingsOpen] = useState(false);
  const [factoryQ, setFactoryQ] = useState("");
  const fq = useQuery({
    queryKey: ["frm", "getFactory"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getFactory")),
    refetchInterval: refetchMs,
  });
  const gq = useQuery({
    queryKey: ["frm", "getGenerators"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getGenerators")),
    refetchInterval: refetchMs,
  });
  const mut = useSetEnabledMut();
  const factories = asFrmRowArray(fq.data);
  const generators = asFrmRowArray(gq.data);
  const fFilter = factoryQ.trim().toLowerCase();
  const factoriesFiltered = useMemo(() => {
    if (!fFilter) return factories;
    return factories.filter((r) => {
      const blob = [
        String(r.ID ?? ""),
        String(r.Name ?? ""),
        String(r.ClassName ?? ""),
        frmgClassLabel(factoryBuildingClassForThumb(r), "fr"),
        frmgClassLabel(factoryBuildingClassForThumb(r), "en"),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(fFilter);
    });
  }, [factories, fFilter]);
  const genSlice = generators.slice(0, 200);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain pb-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sf-display text-lg font-semibold uppercase tracking-[0.12em] text-sf-cyan sm:text-xl">
            {t("control.pageTitle")}
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-sf-muted sm:text-sm">{t("control.pageHint")}</p>
        </div>
        <div className="flex gap-2">
          <ItemThumb className="Build_PriorityPowerSwitch_C" label="" size={44} />
          <ItemThumb className="Build_ManufacturerMk1_C" label="" size={44} />
        </div>
      </header>

      <section className="sf-panel overflow-hidden">
        <div className="sf-panel-header flex flex-wrap items-center justify-between gap-2 border-b border-sf-border/50 bg-gradient-to-r from-sf-orange/12 to-transparent">
          <div className="flex min-w-0 items-center gap-2">
            <ItemThumb className="Build_PowerStorageMk1_C" label="" size={28} />
            <span className="min-w-0 truncate font-medium uppercase tracking-wider text-sf-cream">
              {t("control.powerFavoritesTitle")}
            </span>
          </div>
          <button type="button" className="sf-btn shrink-0 text-xs" onClick={() => setFavoritesSettingsOpen(true)}>
            {t("control.openFavoritesSettings")}
          </button>
        </div>
        <p className="border-b border-sf-border/40 px-3 py-2 text-xs text-sf-muted sm:px-4">{t("control.powerFavoritesHint")}</p>
      </section>

      <ControlFavoriteGroupsBulkPanel isAdmin={isAdmin} />

      <ControlFavoritesSettingsModal
        open={favoritesSettingsOpen}
        onClose={() => setFavoritesSettingsOpen(false)}
        isAdmin={isAdmin}
      />

      <section className="sf-panel overflow-hidden">
        <div className="sf-panel-header flex items-center gap-2 border-b border-sf-border/50 bg-gradient-to-r from-sf-cyan/10 to-transparent">
          <ItemThumb className="Build_PriorityPowerSwitch_C" label="" size={28} />
          <span className="font-medium uppercase tracking-wider text-sf-cream">{t("control.sectionSwitches")}</span>
        </div>
        <div className="p-3 sm:p-4">
          <FrmSwitchesPanel />
        </div>
      </section>

      <section className="sf-panel overflow-hidden">
        <div className="sf-panel-header flex flex-wrap items-center justify-between gap-2 border-b border-sf-border/50 bg-gradient-to-r from-sf-orange/10 to-transparent">
          <div className="flex items-center gap-2">
            <ItemThumb className="Build_ManufacturerMk1_C" label="" size={28} />
            <span className="font-medium uppercase tracking-wider text-sf-cream">{t("control.sectionFactory")}</span>
          </div>
          <input
            type="search"
            value={factoryQ}
            onChange={(e) => setFactoryQ(e.target.value)}
            placeholder={t("control.factorySearch")}
            className="sf-input max-w-xs min-h-8 text-xs"
          />
        </div>
        <div className="max-h-[min(55vh,520px)] overflow-y-auto p-3 sm:p-4">
          {fq.isError ?
            <p className="text-sm text-sf-orange">{(fq.error as Error).message}</p>
          : fq.isPending ?
            <FicsitPageLoader density="compact" className="min-h-40 border-0 bg-transparent" />
          : !factoriesFiltered.length ?
            <p className="text-sm text-sf-muted">{t("monitoring.empty")}</p>
          : (
            <ul className="space-y-2">
              {factoriesFiltered.slice(0, 400).map((r, i) => (
                <FactoryEnableRow key={String(r.ID ?? i)} row={r} lang={i18n.language} mut={mut} isAdmin={isAdmin} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="sf-panel overflow-hidden">
        <div className="sf-panel-header flex items-center gap-2 border-b border-sf-border/50 bg-gradient-to-r from-sf-ok/10 to-transparent">
          <ItemThumb className="Build_GeneratorNuclear_C" label="" size={28} />
          <span className="font-medium uppercase tracking-wider text-sf-cream">{t("control.sectionGenerators")}</span>
        </div>
        <div className="max-h-[min(45vh,420px)] overflow-y-auto p-3 sm:p-4">
          {gq.isError ?
            <p className="text-sm text-sf-orange">{(gq.error as Error).message}</p>
          : gq.isPending ?
            <FicsitPageLoader density="compact" className="min-h-40 border-0 bg-transparent" />
          : !genSlice.length ?
            <p className="text-sm text-sf-muted">{t("monitoring.empty")}</p>
          : (
            <ul className="space-y-2">
              {genSlice.map((r, i) => (
                <GeneratorEnableRow
                  key={String(r.ID ?? r.ClassName ?? i)}
                  row={r}
                  lang={i18n.language}
                  mut={mut}
                  isAdmin={isAdmin}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export function ControlPage() {
  return (
    <MonitoringGate>
      <ControlPageBody />
    </MonitoringGate>
  );
}
