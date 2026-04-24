import { useTranslation } from "react-i18next";

const MASCOT = "/ficsit.png";

export type FicsitPageLoaderProps = {
  /** Plein écran (démarrage app) ou zone de contenu */
  variant?: "fullscreen" | "embedded";
  /** Mascotte plus petite dans les panneaux */
  density?: "page" | "compact";
  className?: string;
};

export function FicsitPageLoader({ variant = "embedded", density = "page", className = "" }: FicsitPageLoaderProps) {
  const { t } = useTranslation();
  const compact = density === "compact";
  const imgClass = compact ? "sf-ficsit-bob h-20 w-20 sm:h-24 sm:w-24" : "sf-ficsit-bob h-28 w-28 sm:h-36 sm:w-36";

  const shell =
    variant === "fullscreen" ?
      `relative flex min-h-[100dvh] w-full flex-col items-center justify-center  sf-grid-bg ${className}`
    : `relative flex w-full min-w-0 flex-col items-center justify-center  bg-transparent ${compact ? "min-h-44 py-6" : "min-h-[min(58dvh,520px)] py-10"} ${className}`;

  return (
    <div className={shell.trim()} role="status" aria-live="polite" aria-busy="true">
      <div className="relative z-10 flex flex-col items-center gap-4 px-4">
        <img src={MASCOT} alt="" className={`sf-ficsit-mascot ${imgClass} max-w-[min(90vw,280px)] object-contain`} />
        <p className="sf-display text-center text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-sf-orange/95 animate-pulse sm:text-xs">
          {t("common.loading")}
        </p>
      </div>
    </div>
  );
}
