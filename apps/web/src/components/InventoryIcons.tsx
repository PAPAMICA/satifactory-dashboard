/** Icônes inline (stroke) pour inventaire / widget favoris — couleur via currentColor. */

export function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15zm9.2 2-5.4-5.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconHeart({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      {filled ?
        <path
          d="M12 21s-7-4.35-9.33-8.14C.38 9.23 2.27 5 6.11 5c2.06 0 3.89 1.29 4.89 3.11A5.55 5.55 0 0 1 17.89 5C21.73 5 23.62 9.23 21.33 12.86 19 16.65 12 21 12 21z"
          fill="currentColor"
          opacity="0.92"
        />
      : <path
          d="M12 21s-7-4.35-9.33-8.14C.38 9.23 2.27 5 6.11 5c2.06 0 3.89 1.29 4.89 3.11A5.55 5.55 0 0 1 17.89 5C21.73 5 23.62 9.23 21.33 12.86 19 16.65 12 21 12 21z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinejoin="round"
        />
      }
    </svg>
  );
}

export function IconLayers({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 4 7v2l8 4 8-4V7l-8-4zm-8 9 8 4 8-4M4 16l8 4 8-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconBookWiki({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H5V4zm8 0h6v10h-6M8 8h4M8 12h4"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 16v4l2-2" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
    </svg>
  );
}

export function IconTrendUp({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 14v6h6M20 4l-6 6-4-4-6 6"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
