import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ItemThumb } from "@/components/ItemThumb";
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
        const nm = String(r.Name ?? r.name ?? r.SwitchTag ?? "").trim() || id;
        const cls = String(r.ClassName ?? r.className ?? "Build_PowerSwitch_C").trim();
        const pri = r.Priority ?? r.priority;
        const priN = typeof pri === "number" ? pri : Number(pri);
        const typeLbl = frmgClassLabel(cls, i18n.language);
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
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <ItemThumb className={cls} label="" size={compact ? 32 : 40} />
              <div className="min-w-0 flex-1">
                <p className={`truncate font-medium text-sf-cream ${compact ? "text-xs" : "text-sm"}`}>{nm}</p>
                <p className="truncate font-mono text-[0.6rem] text-sf-muted">{typeLbl}</p>
                {!compact && Number.isFinite(priN) && priN >= 0 ?
                  <p className="mt-0.5 text-[0.6rem] text-sf-cyan">
                    {t("control.switchPriority", { n: Math.round(priN) })}
                  </p>
                : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:pl-2">
              <span
                className={`rounded px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider ${
                  on ? "bg-sf-ok/15 text-sf-ok" : "bg-sf-orange/15 text-sf-orange"
                }`}
              >
                {on ? t("control.stateOn") : t("control.stateOff")}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => mut.mutate({ id, status: !on })}
                className={
                  compact ?
                    "sf-btn min-h-8 px-2.5 py-1 text-[0.65rem]"
                  : "sf-btn min-h-9 px-3 py-1.5 text-xs"
                }
              >
                {busy ? t("common.loading") : on ? t("control.turnOff") : t("control.turnOn")}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
