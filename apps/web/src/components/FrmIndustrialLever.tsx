import { useTranslation } from "react-i18next";

type Props = {
  on: boolean;
  busy?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  labelOn?: string;
  labelOff?: string;
  compact?: boolean;
};

/** Levier ON/OFF style tableau de bord industriel. */
export function FrmIndustrialLever({ on, busy, disabled, onToggle, labelOn, labelOff, compact }: Props) {
  const { t } = useTranslation();
  const lo = labelOff ?? t("control.stateOff");
  const hi = labelOn ?? t("control.stateOn");
  const trackH = compact ? "h-9 min-w-[5.25rem]" : "h-11 min-w-[6.25rem]";

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onToggle}
      aria-pressed={on}
      title={on ? hi : lo}
      className={
        `relative shrink-0 rounded-full border-2 border-black/50 bg-gradient-to-b from-[#2c2822] to-[#0f0e0c] p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.55),0_2px_6px_rgba(0,0,0,0.4)] outline-none transition-transform ` +
        `${disabled || busy ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:brightness-110 active:scale-[0.97]"} ` +
        `${on ? "ring-2 ring-sf-ok/45" : "ring-2 ring-sf-orange/30"}`
      }
    >
      <span className={`relative flex ${trackH} items-stretch rounded-full bg-[#080706]`}>
        <span
          className={
            "pointer-events-none absolute top-1 bottom-1 w-[calc(50%-6px)] rounded-full border border-white/10 bg-gradient-to-b shadow-md transition-all duration-200 ease-out " +
            (on ? "from-sf-ok to-emerald-900 shadow-[0_0_14px_rgba(52,211,153,0.35)]" : "from-[#4a4238] to-[#1a1714]")
          }
          style={{ left: on ? "calc(50% + 3px)" : "4px" }}
        />
        <span className="relative z-[1] flex flex-1 items-center justify-center px-1 font-mono text-[0.52rem] font-bold uppercase tracking-wide text-sf-muted/85">
          {lo}
        </span>
        <span className="relative z-[1] flex flex-1 items-center justify-center px-1 font-mono text-[0.52rem] font-bold uppercase tracking-wide text-sf-muted/85">
          {hi}
        </span>
      </span>
      {busy ?
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs text-sf-cream">
          …
        </span>
      : null}
    </button>
  );
}
