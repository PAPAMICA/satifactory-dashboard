import { useEffect, useRef, useState } from "react";
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

function ThumbPlaceholder({ size }: { size: number }) {
  return (
    <span
      className="block shrink-0 rounded border border-sf-border/35 bg-black/30 ring-1 ring-white/[0.04]"
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

export function ItemThumb({
  className,
  label,
  size = 36,
  /** Image au-dessus de la ligne de flottaison / héros : charge sans attendre le scroll. */
  priority = false,
}: {
  className: string;
  label: string;
  size?: number;
  priority?: boolean;
}) {
  const src = itemImageUrl(className);
  const [ok, setOk] = useState(Boolean(src));
  const [showImg, setShowImg] = useState(priority);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOk(Boolean(src));
  }, [src]);

  useEffect(() => {
    if (priority) {
      setShowImg(true);
      return;
    }
    if (!src) {
      setShowImg(false);
      return;
    }
    setShowImg(false);
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShowImg(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShowImg(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin: "180px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src, priority, className]);

  if (!src || !ok) {
    return <FicsitFallbackMark size={size} title={label} />;
  }

  return (
    <div
      ref={wrapRef}
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      {!showImg ?
        <ThumbPlaceholder size={size} />
      : (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className="size-full shrink-0 object-contain"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          onError={() => setOk(false)}
        />
      )}
    </div>
  );
}
