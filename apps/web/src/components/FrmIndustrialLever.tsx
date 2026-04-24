import { useTranslation } from "react-i18next";

import "./FrmIndustrialLever.css";

type Props = {
  on: boolean;
  busy?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  /** Libellés accessibilité (title / aria). */
  labelOn?: string;
  labelOff?: string;
  /** @deprecated Conservé pour compat ; non affiché. */
  showLabels?: boolean;
  /** `compact` / `mini` / `micro` : dimensions réduites (listes, cartes dashboard, cartes contrôle). */
  size?: "default" | "compact" | "mini" | "micro";
};

/**
 * Interrupteur d’alimentation style « kill switch » 3D (inspiré Uiverse.io / Nawsome).
 */
export function FrmIndustrialLever({
  on,
  busy,
  disabled,
  onToggle,
  labelOn,
  labelOff,
  size = "default",
}: Props) {
  const { t } = useTranslation();
  const lo = labelOff ?? t("control.stateOff");
  const hi = labelOn ?? t("control.stateOn");
  const isDisabled = Boolean(disabled || busy);
  const compact = size === "compact";
  const mini = size === "mini";
  const micro = size === "micro";

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onToggle}
      aria-pressed={on}
      aria-busy={busy || undefined}
      aria-label={on ? hi : lo}
      title={on ? hi : lo}
      className={
        "frmIndustrialLever " +
        (micro ? "frmIndustrialLever--micro " : mini ? "frmIndustrialLever--mini " : compact ? "frmIndustrialLever--compact " : "") +
        (isDisabled ? "frmIndustrialLever--disabled " : "")
      }
    >
      <span className="frmIndustrialLever-housing">
        <span className={"frmIndustrialLever-plate " + (on ? "frmIndustrialLever-plate--on" : "")}>
          <span className="frmIndustrialLever-light" aria-hidden />
          <span className="frmIndustrialLever-dots" aria-hidden />
          <span className="frmIndustrialLever-characters" aria-hidden />
          <span className="frmIndustrialLever-shine" aria-hidden />
          <span className="frmIndustrialLever-shadow" aria-hidden />
        </span>
      </span>
      {busy ?
        <span className="frmIndustrialLever-busy" aria-hidden>
          <span className="frmIndustrialLever-busyDot" />
        </span>
      : null}
    </button>
  );
}
