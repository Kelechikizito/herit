import type { EstateStatus } from "@/lib/estate";

/** The arc colour per state. Hex rather than a class — this is an SVG stroke, not a background. */
const ARC_COLOR: Record<EstateStatus, string> = {
  active: "#4ECDC4",
  grace: "#FFE566",
  unlocked: "#E8635A",
};

/**
 * The countdown ring. An SVG circle whose dash offset tracks `progress` (0 = window just reset,
 * 1 = window spent), coloured by the state it is counting down toward.
 */
export function CountdownRing({
  progress,
  status,
  children,
  size = 208,
}: {
  progress: number;
  status: EstateStatus;
  children: React.ReactNode;
  size?: number;
}) {
  const stroke = 14;
  const radius = (size - stroke) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#111111"
          strokeWidth={stroke + 4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ARC_COLOR[status]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
