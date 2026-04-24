import { useTranslation } from "react-i18next";

type Props = {
  on: boolean;
  busy?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  labelOn?: string;
  labelOff?: string;
  compact?: boolean;
  /** Afficher les libellés ON/OFF dans le levier (désactivé pour les interrupteurs). */
  showLabels?: boolean;
};

/** Levier ON/OFF style tableau de bord industriel. */
export function FrmIndustrialLever({
  on,
  busy,
  disabled,
  onToggle,
  labelOn,
  labelOff,
  compact,
  showLabels = true,
}: Props) {
  const { t } = useTranslation();
  const lo = labelOff ?? t("control.stateOff");
  const hi = labelOn ?? t("control.stateOn");
  const trackH = compact ? "h-9 min-w-[5.25rem]" : "h-11 min-w-[6.25rem]";
  const trackHNoLabels = compact ? "h-9 w-[3.25rem]" : "h-11 w-[4rem]";

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? hi : lo}
      title={on ? hi : lo}
      className={
        `relative shrink-0 rounded-full border-2 border-black/50 bg-gradient-to-b from-[#2c2822] to-[#0f0e0c] p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.55),0_2px_6px_rgba(0,0,0,0.4)] outline-none transition-transform ` +
        `${disabled || busy ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:brightness-110 active:scale-[0.97]"} ` +
        `${on ? "ring-2 ring-sf-orange/55" : "ring-2 ring-sf-orange/25"}`
      }
    >
      <span className={`relative flex ${showLabels ? trackH : trackHNoLabels} items-stretch rounded-full bg-[#080706]`}>
        <span
          className={
            "pointer-events-none absolute top-1 bottom-1 rounded-full border border-white/10 bg-gradient-to-b shadow-md transition-all duration-200 ease-out " +
            (showLabels ? "w-[calc(50%-6px)] " : "w-[46%] ") +
            (on ?
              "from-sf-orange to-amber-950 shadow-[0_0_14px_rgba(251,146,60,0.45)]"
            : "from-[#4a4238] to-[#1a1714]")
          }
          style={showLabels ? { left: on ? "calc(50% + 3px)" : "4px" } : { left: on ? "calc(54% - 2px)" : "4px" }}
        />
        {showLabels ?
          <>
            <span className="relative z-[1] flex flex-1 items-center justify-center px-1 font-mono text-[0.52rem] font-bold uppercase tracking-wide text-sf-muted/85">
              {lo}
            </span>
            <span className="relative z-[1] flex flex-1 items-center justify-center px-1 font-mono text-[0.52rem] font-bold uppercase tracking-wide text-sf-muted/85">
              {hi}
            </span>
          </>
        : null}
      </span>
      {busy ?
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs text-sf-cream">
          …
        </span>
      : null}
    </button>
  );
}
