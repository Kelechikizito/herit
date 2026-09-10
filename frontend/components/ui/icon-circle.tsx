const SIZES = {
  "2xs": "h-5 w-5",
  xs: "h-6 w-6",
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-9 w-9",
  xl: "h-10 w-10",
} as const;

export type CircleSize = keyof typeof SIZES;

/**
 * A bordered circle holding a glyph, a number, or a tick.
 *
 * The avatars, the stepper bullets, the requirement ticks and the vault rows are all this shape at
 * different diameters, so the 2px border and the flex centring live in one place.
 */
export function IconCircle({
  size = "xl",
  accent = "bg-surface",
  className = "",
  children,
}: {
  size?: CircleSize;
  /** Background utility, usually a palette swatch. */
  accent?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-full border-2 border-ink ${SIZES[size]} ${accent} ${className}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
