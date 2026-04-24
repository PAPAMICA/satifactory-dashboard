import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ItemThumb } from "@/components/ItemThumb";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import type { ControlPinMeta } from "@/lib/dashboardWidgetCatalog";
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
import { factoryBuildingClassForThumb } from "@/lib/productionFrm";
import { normalizeBuildClassName } from "@/lib/monitoringFrm";

type Props = {
  pins: ControlPinMeta[];
  editMode: boolean;
  onAddPin: (pin: ControlPinMeta) => void;
  onRemovePin: (id: string, kind: ControlPinMeta["kind"]) => void;
};

function resolvePinMeta(
  pin: ControlPinMeta,
  switches: Record<string, unknown>[],
  factories: Record<string, unknown>[],
  generators: Record<string, unknown>[],
  lang: string,
): { title: string; thumb: string } {
  if (pin.label?.trim()) return { title: pin.label.trim(), thumb: "Build_PriorityPowerSwitch_C" };
  if (pin.kind === "switch") {
    const row = switches.find((s) => switchRowId(s) === pin.id);
    if (row) {
      const cls = String(row.ClassName ?? row.className ?? "Build_PowerSwitch_C").trim();
      const nm = String(row.Name ?? row.name ?? "").trim();
      return { title: nm || pin.id, thumb: cls };
    }
    return { title: pin.id, thumb: "Build_PriorityPowerSwitch_C" };
  }
  const fac = factories.find((r) => String(r.ID ?? r.Id ?? "") === pin.id);
  if (fac) {
    const thumb = factoryBuildingClassForThumb(fac);
    const nm = String(fac.Name ?? fac.name ?? "").trim();
    return { title: nm || pin.id, thumb };
  }
  const gen = generators.find((r) => String(r.ID ?? r.Id ?? r.id ?? "") === pin.id);
  if (gen) {
    const raw = String(gen.ClassName ?? gen.className ?? "").trim();
    const thumb = raw ? normalizeBuildClassName(raw) : "Build_GeneratorCoal_C";
    const img = thumb !== "—" ? thumb : "Build_GeneratorCoal_C";
    const nm = String(gen.Name ?? gen.name ?? "").trim();
    return { title: nm || pin.id, thumb: img };
  }
  return { title: pin.id, thumb: "Build_WorkBench_C" };
}

export function FrmDashboardControlWidget({ pins, editMode, onAddPin, onRemovePin }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const refetchMs = useFrmRefetchMs();
  const swQ = useQuery({
    queryKey: ["frm", "getSwitches"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getSwitches")),
    refetchInterval: refetchMs,
    enabled: editMode || pins.some((p) => p.kind === "switch"),
  });
  const facQ = useQuery({
    queryKey: ["frm", "getFactory"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getFactory")),
    refetchInterval: refetchMs,
    enabled: editMode || pins.some((p) => p.kind === "building"),
  });
  const genQ = useQuery({
    queryKey: ["frm", "getGenerators"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getGenerators")),
    refetchInterval: refetchMs,
    enabled: editMode,
  });
  const switches = asFrmRowArray(swQ.data);
  const factories = asFrmRowArray(facQ.data);
  const generators = asFrmRowArray(genQ.data);

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

  const pickerRows = useMemo(() => {
    if (!editMode) return [] as { kind: ControlPinMeta["kind"]; id: string; title: string; thumb: string }[];
    const out: { kind: ControlPinMeta["kind"]; id: string; title: string; thumb: string }[] = [];
    for (const s of switches) {
      const id = switchRowId(s);
      if (!id || pins.some((p) => p.kind === "switch" && p.id === id)) continue;
      const cls = String(s.ClassName ?? s.className ?? "Build_PowerSwitch_C").trim();
      const nm = String(s.Name ?? s.name ?? "").trim() || id;
      out.push({ kind: "switch", id, title: nm, thumb: cls });
    }
    for (const r of factories.slice(0, 80)) {
      const id = String(r.ID ?? r.Id ?? "").trim();
      if (!id || pins.some((p) => p.kind === "building" && p.id === id)) continue;
      out.push({
        kind: "building",
        id,
        title: String(r.Name ?? r.name ?? id).trim(),
        thumb: factoryBuildingClassForThumb(r),
      });
    }
    for (const r of generators.slice(0, 40)) {
      const id = String(r.ID ?? r.Id ?? r.id ?? "").trim();
      if (!id || pins.some((p) => p.kind === "building" && p.id === id)) continue;
      const raw = String(r.ClassName ?? r.className ?? "").trim();
      const thumb = raw ? normalizeBuildClassName(raw) : "Build_GeneratorCoal_C";
      const img = thumb !== "—" ? thumb : "Build_GeneratorCoal_C";
      out.push({ kind: "building", id, title: String(r.Name ?? r.name ?? id).trim(), thumb: img });
    }
    return out.slice(0, 24);
  }, [editMode, switches, factories, generators, pins]);

  if (!pins.length && !editMode) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-xs text-sf-muted">{t("dashboard.widgets.controlEmpty")}</p>
        <p className="text-[0.65rem] text-sf-muted/80">{t("dashboard.widgets.controlEmptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2 sm:p-3">
      {editMode && pickerRows.length ?
        <div className="shrink-0 rounded-lg border border-sf-cyan/25 bg-sf-cyan/5 p-2">
          <p className="mb-1.5 text-[0.6rem] font-medium uppercase tracking-wider text-sf-cyan">
            {t("dashboard.widgets.controlAddQuick")}
          </p>
          <ul className="max-h-28 space-y-1 overflow-y-auto">
            {pickerRows.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded border border-sf-border/40 bg-black/20 px-2 py-1 text-left text-[0.65rem] text-sf-cream hover:border-sf-cyan/40"
                  onClick={() => onAddPin({ kind: r.kind, id: r.id, label: r.title })}
                >
                  <ItemThumb className={r.thumb} label="" size={22} />
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  <span className="shrink-0 text-[0.55rem] text-sf-muted">{r.kind === "switch" ? "SW" : "Δ"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      : null}

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
        {pins.map((pin) => {
          const meta = resolvePinMeta(pin, switches, factories, generators, i18n.language);
          const typeLbl = frmgClassLabel(meta.thumb, i18n.language);
          const swRow = pin.kind === "switch" ? switches.find((s) => switchRowId(s) === pin.id) : null;
          const on = pin.kind === "switch" && swRow ? switchRowIsOn(swRow) : readCachedBuildingEnabled(pin.id) ?? true;
          const busy =
            pin.kind === "switch" ? swMut.isPending && swMut.variables?.id === pin.id
            : enMut.isPending && enMut.variables?.id === pin.id;

          return (
            <li
              key={`${pin.kind}-${pin.id}`}
              className="flex items-center gap-2 rounded-lg border border-sf-border/60 bg-black/25 px-2 py-2 ring-1 ring-white/[0.03]"
            >
              <ItemThumb className={meta.thumb} label="" size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-sf-cream">{meta.title}</p>
                <p className="truncate font-mono text-[0.55rem] text-sf-muted">{typeLbl}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                className="sf-btn shrink-0 px-2 py-1 text-[0.65rem]"
                onClick={() =>
                  pin.kind === "switch" ? swMut.mutate({ id: pin.id, status: !on }) : enMut.mutate({ id: pin.id, status: !on })
                }
              >
                {busy ? "…" : on ? t("control.cutShort") : t("control.onShort")}
              </button>
              {editMode ?
                <button
                  type="button"
                  className="shrink-0 rounded px-1.5 text-[0.65rem] text-sf-danger hover:bg-white/10"
                  onClick={() => onRemovePin(pin.id, pin.kind)}
                  aria-label={t("dashboard.widgets.controlRemovePin")}
                >
                  ×
                </button>
              : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
