/**
 * The brand mascot: a little sofa with a face. Pure SVG + CSS animation (blinks, bounces,
 * blushes; "party" adds a hat and happy jumps). Works in server and client components.
 */
export function SofaBuddy({ mood = "wave", size = 220 }: { mood?: "wave" | "party"; size?: number }) {
  return (
    <svg
      className={`buddy buddy-${mood}`}
      width={size}
      height={size * 0.86}
      viewBox="0 0 260 224"
      role="img"
      aria-label={mood === "party" ? "A happy sofa celebrating" : "A smiling sofa waving hello"}
    >
      <ellipse className="buddy-shadow" cx="130" cy="214" rx="86" ry="8" />
      <g className="buddy-body">
        {mood === "party" && (
          <g className="buddy-hat">
            <path d="M118 38 138 -4 158 38Z" fill="#111111" />
            <path d="M124 26 152 26M128 16 148 16" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
            <circle cx="138" cy="-6" r="7" fill="#c8102e" />
          </g>
        )}
        {/* legs */}
        <rect x="58" y="176" width="12" height="26" rx="5" fill="#111111" />
        <rect x="190" y="176" width="12" height="26" rx="5" fill="#111111" />
        {/* back cushion = face */}
        <rect x="52" y="36" width="156" height="104" rx="34" fill="#d41f2c" />
        {/* seat */}
        <rect x="40" y="116" width="180" height="62" rx="26" fill="#111111" />
        <rect x="62" y="118" width="136" height="26" rx="13" fill="#e8424f" />
        {/* arms (the right one waves) */}
        <rect x="20" y="92" width="44" height="86" rx="22" fill="#b8141f" />
        <g className="buddy-arm">
          <rect x="196" y="92" width="44" height="86" rx="22" fill="#b8141f" />
        </g>
        {/* face */}
        <g className="buddy-eyes">
          <ellipse cx="106" cy="82" rx="9" ry="12" fill="#111111" />
          <ellipse cx="154" cy="82" rx="9" ry="12" fill="#111111" />
          <circle cx="109" cy="77" r="3.2" fill="#fff" />
          <circle cx="157" cy="77" r="3.2" fill="#fff" />
        </g>
        <circle className="buddy-blush" cx="88" cy="104" r="9" fill="#ff9fa8" />
        <circle className="buddy-blush" cx="172" cy="104" r="9" fill="#ff9fa8" />
        <path d="M112 100 Q130 122 148 100" fill="none" stroke="#111111" strokeWidth="6" strokeLinecap="round" />
        <path d="M120 106 Q130 116 140 106 Z" fill="#ff6b78" />
      </g>
    </svg>
  );
}
