import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ItemThumb } from "@/components/ItemThumb";
import { filterCatalogClassNames } from "@/lib/itemCatalog";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";

type Props = {
  value: string;
  onChange: (className: string) => void;
  className?: string;
};

/** Grille d’icônes catalogue (objets / bâtiments) avec recherche multilingue. */
export function FrmAssetClassPicker({ value, onChange, className = "" }: Props) {
  const { i18n, t } = useTranslation();
  const [q, setQ] = useState("");
  const lang = i18n.language;
  const filtered = useMemo(() => filterCatalogClassNames(lang, q, 400), [lang, q]);

  return (
    <div className={`flex min-h-0 flex-col gap-2 ${className}`}>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("control.assetCatalogSearch")}
        className="sf-input min-h-9 w-full text-xs"
      />
      <div className="max-h-[min(40vh,280px)] min-h-0 overflow-y-auto rounded border border-sf-border/50 bg-black/25 p-2">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
          {filtered.map((cls) => {
            const lbl = frmgClassLabel(cls, lang);
            const sel = cls === value;
            return (
              <li key={cls}>
                <button
                  type="button"
                  onClick={() => onChange(cls)}
                  className={
                    "flex w-full flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors " +
                    (sel ? "border-sf-orange/70 bg-sf-orange/10 ring-1 ring-sf-orange/30" : "border-sf-border/40 hover:border-sf-orange/35")
                  }
                >
                  <ItemThumb className={cls} label="" size={40} />
                  <span className="line-clamp-2 text-[0.58rem] leading-tight text-sf-cream">{lbl}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {!filtered.length ?
          <p className="py-6 text-center text-xs text-sf-muted">{t("monitoring.empty")}</p>
        : null}
      </div>
    </div>
  );
}
