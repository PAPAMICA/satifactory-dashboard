import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FrmIndustrialLever } from "@/components/FrmIndustrialLever";
import { ItemThumb } from "@/components/ItemThumb";
import { buildingClassSupportsSetEnabled } from "@/lib/frmBuildingPowerPolicy";
import {
  cacheBuildingEnabled,
  parseSetEnabledStatus,
  postSetEnabled,
  readCachedBuildingEnabled,
} from "@/lib/frmControl";

type Props = {
  buildingId: string;
  /** Classe UE pour filtrer les bâtiments non supportés par `setEnabled`. */
  buildingClassName: string;
  title: string;
  subtitle?: string;
  compact?: boolean;
};

/**
 * Bloc « sectionneur » : alimentation ON/OFF via FRM `setEnabled` (bâtiments compatibles uniquement).
 */
export function FrmBuildingPowerToggle({ buildingId, buildingClassName, title, subtitle, compact }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const supported = buildingClassSupportsSetEnabled(buildingClassName);
  const [guess, setGuess] = useState<boolean>(() => readCachedBuildingEnabled(buildingId) ?? true);

  useEffect(() => {
    const c = readCachedBuildingEnabled(buildingId);
    if (c !== undefined) setGuess(c);
  }, [buildingId]);

  const mut = useMutation({
    mutationFn: async (next: boolean) => postSetEnabled({ ID: buildingId, status: next }),
    onSuccess: (data, next) => {
      const parsed = parseSetEnabledStatus(data);
      const resolved = parsed ?? next;
      setGuess(resolved);
      cacheBuildingEnabled(buildingId, resolved);
      void qc.invalidateQueries({ queryKey: ["frm", "getFactory"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getGenerators"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getPower"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getPowerUsage"] });
    },
  });

  if (!supported) return null;

  const busy = mut.isPending;
  const err = mut.error instanceof Error ? mut.error.message : mut.error ? String(mut.error) : null;

  return (
    <div
      className={
        compact ?
          "rounded-xl border border-sf-border/80 bg-gradient-to-br from-[#1c1915] via-[#12100e] to-black/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_20px_rgba(0,0,0,0.35)] ring-1 ring-black/40"
        : "rounded-2xl border border-sf-border/80 bg-gradient-to-br from-[#221e18] via-[#14120f] to-black/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_28px_rgba(0,0,0,0.45)] ring-1 ring-sf-orange/15 sm:p-5"
      }
    >
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex w-full min-w-0 flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div
            className={
              "flex shrink-0 items-center justify-center rounded-lg border border-sf-border/50 bg-black/40 p-2 shadow-inner " +
              (compact ? "p-1.5" : "p-2")
            }
          >
            <ItemThumb className={buildingClassName || "Build_ManufacturerMk1_C"} label="" size={compact ? 40 : 52} />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="font-mono text-[0.58rem] font-medium uppercase tracking-[0.14em] text-sf-orange/90">
              {t("control.buildingPower")}
            </p>
            <p className={`mt-0.5 font-semibold text-sf-cream ${compact ? "text-sm" : "text-base"}`}>{title}</p>
            {subtitle ? <p className="truncate text-xs text-sf-muted">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 sm:items-end">
          <FrmIndustrialLever
            on={guess}
            busy={busy}
            onToggle={() => mut.mutate(!guess)}
            compact={compact}
          />
        </div>
      </div>
      {err ? <p className="mt-2 text-center text-[0.65rem] text-sf-danger sm:text-left">{err}</p> : null}
    </div>
  );
}
