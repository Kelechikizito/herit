/**
 * The decorative layer.
 *
 * Absolutely positioned, `aria-hidden`, never part of the layout grid. DESIGN.md treats this as
 * core to the style rather than garnish: three to six per section is what separates neobrutalism
 * from "cards with borders".
 */

type DecoProps = {
  /** Tailwind positioning utilities, e.g. "left-8 top-24". */
  className?: string;
  size?: number;
  fill?: string;
  rotate?: number;
};

function decoStyle(rotate?: number): React.CSSProperties | undefined {
  return rotate ? { transform: `rotate(${rotate}deg)` } : undefined;
}

/** Four-point star badge - the signature mark of the style. */
export function Star({ className = "", size = 32, fill = "#FFE566", rotate }: DecoProps) {
  return (
    <svg
      className={`deco ${className}`}
      style={decoStyle(rotate)}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M16 2 L17.5 14.5 L30 16 L17.5 17.5 L16 30 L14.5 17.5 L2 16 L14.5 14.5 Z"
        fill={fill}
        stroke="#111111"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Soft blob splash - fills negative space without competing with content. */
export function Blob({ className = "", size = 64, fill = "#F9A8B8", rotate }: DecoProps) {
  return (
    <svg
      className={`deco ${className}`}
      style={decoStyle(rotate)}
      width={size}
      height={size}
      viewBox="0 0 80 80"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M40 4 C58 4, 76 18, 76 38 C76 60, 60 76, 39 76 C18 76, 4 61, 4 40 C4 19, 22 4, 40 4 Z"
        fill={fill}
        stroke="#111111"
        strokeWidth="2"
      />
    </svg>
  );
}

/** Sparkle cluster - a smaller, quieter accent than the star. */
export function Sparkle({ className = "", size = 24, fill = "#7B6CF6", rotate }: DecoProps) {
  return (
    <svg
      className={`deco ${className}`}
      style={decoStyle(rotate)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 1 L13.6 9.4 L22 11 L13.6 12.6 L12 21 L10.4 12.6 L2 11 L10.4 9.4 Z"
        fill={fill}
        stroke="#111111"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Hand-drawn squiggle - reads as an underline or a divider. */
export function Squiggle({
  className = "",
  size = 120,
  fill = "#4ECDC4",
  rotate,
}: DecoProps) {
  return (
    <svg
      className={`deco ${className}`}
      style={decoStyle(rotate)}
      width={size}
      height={size * 0.2}
      viewBox="0 0 120 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 16 C14 4, 26 4, 38 14 C50 24, 62 24, 74 14 C86 4, 98 4, 118 14"
        fill="none"
        stroke={fill}
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Concentric ring - a quiet target/orbit motif for liveness sections. */
export function Ring({ className = "", size = 56, fill = "#C4B5FD", rotate }: DecoProps) {
  return (
    <svg
      className={`deco ${className}`}
      style={decoStyle(rotate)}
      width={size}
      height={size}
      viewBox="0 0 56 56"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="28" cy="28" r="25" fill={fill} stroke="#111111" strokeWidth="2" />
      <circle cx="28" cy="28" r="14" fill="#FAFADF" stroke="#111111" strokeWidth="2" />
    </svg>
  );
}

/** A dotted arc of small circles, used to trail off the edge of a section. */
export function DotTrail({ className = "", size = 90, fill = "#E8635A", rotate }: DecoProps) {
  return (
    <svg
      className={`deco ${className}`}
      style={decoStyle(rotate)}
      width={size}
      height={size * 0.35}
      viewBox="0 0 90 32"
      aria-hidden="true"
      focusable="false"
    >
      {[6, 24, 42, 60, 78].map((cx, index) => (
        <circle
          key={cx}
          cx={cx}
          cy={16 + (index % 2 === 0 ? -5 : 5)}
          r={4.5 - index * 0.4}
          fill={fill}
          stroke="#111111"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}
