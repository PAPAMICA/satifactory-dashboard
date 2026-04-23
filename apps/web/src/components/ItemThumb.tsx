import { useEffect, useState } from "react";
import { itemImageUrl } from "@/lib/itemCatalog";

/** Logo FICSIT de repli (pas d’asset PNG requis). */
function FicsitFallbackMark({ size, title }: { size: number; title: string }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded border border-sf-border bg-gradient-to-br from-black/55 to-black/35 text-sf-orange ring-1 ring-white/[0.06]"
      style={{ width: size, height: size }}
      title={title}
      role="img"
      aria-label="FICSIT"
    >
      <svg
        className="h-[58%] w-[58%] shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M5 4h14v2.6H9.2v3.4H17V12H9.2v8H5V4z"
          opacity="0.95"
        />
      </svg>
    </div>
  );
}

export function ItemThumb({
  className,
  label,
  size = 36,
}: {
  className: string;
  label: string;
  size?: number;
}) {
  const src = itemImageUrl(className);
  const [ok, setOk] = useState(Boolean(src));

  useEffect(() => {
    setOk(Boolean(src));
  }, [src]);

  if (!src || !ok) {
    return <FicsitFallbackMark size={size} title={label} />;
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 object-contain"
      loading="lazy"
      onError={() => setOk(false)}
    />
  );
}
