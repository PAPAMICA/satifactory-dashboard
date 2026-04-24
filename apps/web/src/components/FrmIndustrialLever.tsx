import { useTranslation } from "react-i18next";

type Props = {
  on: boolean;
  busy?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  /** Libellés accessibilité (title / aria) ; pas affichés dans le levier si `showLabels` est faux. */
  labelOn?: string;
  labelOff?: string;
  /** Afficher du texte ON/OFF dans le levier (désactivé par défaut). */
  showLabels?: boolean;
};

/** Levier ON/OFF style industriel — taille unique, sans texte à l’intérieur par défaut. */
export function FrmIndustrialLever({
  on,
  busy,
  disabled,
  onToggle,
  labelOn,
  labelOff,
  showLabels = false,
}: Props) {
  const { t } = useTranslation();
  const lo = labelOff ?? t("control.stateOff");
  const hi = labelOn ?? t("control.stateOn");
  /** Taille unique pour toute l’app (alimentation). */
  const trackNoLabels = "h-6 w-9";
  const trackWithLabels = "h-7 min-w-[5.25rem]";

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? hi : lo}
      title={on ? hi : lo}
      className={
        `relative shrink-0 rounded-full border border-black/60 bg-gradient-to-b from-[#252018] to-[#0c0b09] p-px shadow-[inset_0_1px_4px_rgba(0,0,0,0.55),0_1px_3px_rgba(0,0,0,0.35)] outline-none transition-transform ` +
        `${disabled || busy ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:brightness-110 active:scale-[0.97]"} ` +
        `${on ? "ring-1 ring-sf-orange/50" : "ring-1 ring-sf-orange/20"}`
      }
    >
      <span
        className={`relative flex ${showLabels ? trackWithLabels : trackNoLabels} items-stretch rounded-full bg-[#060504]`}
      >
        <span
          className={
            "pointer-events-none absolute top-px bottom-px rounded-full border border-white/10 bg-gradient-to-b shadow-sm transition-all duration-200 ease-out " +
            (showLabels ? "w-[calc(50%-5px)] " : "w-[44%] ") +
            (on ?
              "from-sf-orange to-amber-950 shadow-[0_0_10px_rgba(251,146,60,0.4)]"
            : "from-[#454038] to-[#151311]")
          }
          style={
            showLabels ? { left: on ? "calc(50% + 2.5px)" : "3px" } : { left: on ? "calc(56% - 1px)" : "3px" }
          }
        />
        {showLabels ?
          <>
            <span className="relative z-[1] flex flex-1 items-center justify-center px-0.5 font-mono text-[0.5rem] font-bold uppercase tracking-wide text-sf-muted/85">
              {lo}
            </span>
            <span className="relative z-[1] flex flex-1 items-center justify-center px-0.5 font-mono text-[0.5rem] font-bold uppercase tracking-wide text-sf-muted/85">
              {hi}
            </span>
          </>
        : null}
      </span>
      {busy ?
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/45">
          <span
            className="size-3.5 animate-spin rounded-full border-2 border-sf-cream/20 border-t-sf-cream/80"
            aria-hidden
          />
        </span>
      : null}
    </button>
  );
}
