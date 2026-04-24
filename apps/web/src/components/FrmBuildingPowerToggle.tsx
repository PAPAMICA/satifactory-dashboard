import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  cacheBuildingEnabled,
  parseSetEnabledStatus,
  postSetEnabled,
  readCachedBuildingEnabled,
} from "@/lib/frmControl";

type Props = {
  buildingId: string;
  title: string;
  subtitle?: string;
  /** Affichage réduit (modale carte). */
  compact?: boolean;
};

/**
 * Alimentation ON/OFF via FRM `setEnabled` (constructeurs, générateurs, etc.).
 * L’état initial n’est pas toujours renvoyé par `getFactory` : cache session après action.
 */
export function FrmBuildingPowerToggle({ buildingId, title, subtitle, compact }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
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

  const busy = mut.isPending;
  const err = mut.error instanceof Error ? mut.error.message : mut.error ? String(mut.error) : null;

  return (
    <div
      className={
        compact ?
          "rounded-lg border border-sf-border/70 bg-black/30 p-2.5 ring-1 ring-sf-cyan/10"
        : "rounded-xl border border-sf-border/70 bg-gradient-to-r from-black/40 via-black/25 to-sf-cyan/5 p-3 ring-1 ring-sf-cyan/15 sm:p-4"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-medium uppercase tracking-wider text-sf-muted ${compact ? "text-[0.55rem]" : "text-[0.6rem]"}`}>
            {t("control.buildingPower")}
          </p>
          <p className={`mt-0.5 truncate text-sf-cream ${compact ? "text-xs" : "text-sm"}`}>{title}</p>
          {subtitle ?
            <p className="truncate font-mono text-[0.6rem] text-sf-muted">{subtitle}</p>
          : null}
          <p className="mt-1 text-[0.58rem] text-sf-muted/90">{t("control.buildingPowerHint")}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 font-mono text-[0.6rem] ${
                guess ? "bg-sf-ok/20 text-sf-ok" : "bg-sf-orange/20 text-sf-orange"
              }`}
            >
              {guess ? t("control.stateOn") : t("control.stateOff")}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => mut.mutate(!guess)}
              className={compact ? "sf-btn min-h-8 px-2.5 text-[0.65rem]" : "sf-btn min-h-9 px-3 text-xs"}
            >
              {busy ? "…" : guess ? t("control.cutPower") : t("control.restorePower")}
            </button>
          </div>
        </div>
      </div>
      {err ? <p className="mt-2 text-[0.65rem] text-sf-danger">{err}</p> : null}
      <p className="mt-1 truncate font-mono text-[0.55rem] text-sf-muted/70" title={buildingId}>
        {buildingId}
      </p>
    </div>
  );
}
