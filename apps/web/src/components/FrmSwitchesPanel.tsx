import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FrmIndustrialLever } from "@/components/FrmIndustrialLever";
import { ItemThumb } from "@/components/ItemThumb";
import { useOpenBuildingDetail } from "@/contexts/BuildingDetailModalContext";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";
import { postSetSwitches, switchRowId, switchRowIsOn } from "@/lib/frmControl";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";

type Props = {
  className?: string;
  /** Affichage compact (widget dashboard). */
  compact?: boolean;
};

export function FrmSwitchesPanel({ className = "", compact }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const refetchMs = useFrmRefetchMs();
  const openBuildingDetail = useOpenBuildingDetail();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ isAdmin?: boolean }>("/api/me"),
    staleTime: 60_000,
  });
  const q = useQuery({
    queryKey: ["frm", "getSwitches"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getSwitches")),
    refetchInterval: refetchMs,
  });
  const rows = asFrmRowArray(q.data);
  const mut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => postSetSwitches({ ID: id, status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["frm", "getSwitches"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getPower"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getPowerUsage"] });
    },
  });

  const wrap = compact ? "space-y-2" : "space-y-3";

  if (q.isError) {
    return <p className={`text-sm text-sf-orange ${className}`}>{(q.error as Error).message}</p>;
  }
  if (q.isPending) {
    return <p className={`text-xs text-sf-muted ${className}`}>{t("common.loading")}</p>;
  }
  if (!rows.length) {
    return <p className={`text-sm text-sf-muted ${className}`}>{t("monitoring.empty")}</p>;
  }

  return (
    <ul className={`${wrap} ${className}`}>
      {rows.map((r, i) => {
        const id = switchRowId(r);
        if (!id) return null;
        const on = switchRowIsOn(r);
        const cls = String(r.ClassName ?? r.className ?? "Build_PowerSwitch_C").trim();
        const pri = r.Priority ?? r.priority;
        const priN = typeof pri === "number" ? pri : Number(pri);
        const titleLbl = frmgClassLabel(cls, i18n.language);
        const busy = mut.isPending && mut.variables?.id === id;
        return (
          <li
            key={`${id}-${i}`}
            className={
              compact ?
                "flex items-center gap-2 rounded-lg border border-sf-border/60 bg-black/25 px-2 py-2 ring-1 ring-white/[0.03]"
              : "flex flex-col gap-2 rounded-xl border border-sf-border/70 bg-gradient-to-br from-black/35 to-black/20 p-3 shadow-sm ring-1 ring-white/[0.04] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-3.5"
            }
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-transparent text-left transition-colors hover:border-sf-orange/30 hover:bg-white/[0.04]"
              onClick={() => openBuildingDetail(r, { showMap: false, showAdminControls: Boolean(me?.isAdmin) })}
            >
              <ItemThumb className={cls} label="" size={compact ? 32 : 40} />
              <div className="min-w-0 flex-1">
                <p className={`truncate font-medium text-sf-cream ${compact ? "text-xs" : "text-sm"}`}>{titleLbl}</p>
                {!compact && Number.isFinite(priN) && priN >= 0 ?
                  <p className="mt-0.5 text-[0.6rem] text-sf-cyan">
                    {t("control.switchPriority", { n: Math.round(priN) })}
                  </p>
                : null}
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-2 sm:pl-2">
              <FrmIndustrialLever size={compact ? "compact" : "default"} on={on} busy={busy} onToggle={() => mut.mutate({ id, status: !on })} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
