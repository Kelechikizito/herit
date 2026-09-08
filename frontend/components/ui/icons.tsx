/**
 * Line icons, hand-rolled rather than pulled from a package.
 *
 * DESIGN.md calls for Lucide-weight strokes (1.75px) at 20-24px inside 48px circles. A dozen
 * glyphs is not worth a dependency in a hackathon bundle, and inlining them keeps the stroke
 * weight consistent with the 2px borders around them.
 */

export type IconProps = {
  className?: string;
  size?: number;
};

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: "false" as const,
  };
}

/** Proof of life. */
export function PulseIcon({ className, size = 22 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M2 12h4l2.5-7 4 14 3-9 2 2h4.5" />
    </svg>
  );
}

/** A face inside a frame - the Selfie Check. */
export function SelfieIcon({ className, size = 22 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="11" r="2.4" />
      <path d="M8 17c.7-1.7 2.1-2.6 4-2.6s3.3.9 4 2.6" />
    </svg>
  );
}

/** Hierarchical naming - a parent node with children. */
export function TreeIcon({ className, size = 22 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <circle cx="12" cy="4.5" r="2.5" />
      <circle cx="5.5" cy="19.5" r="2.5" />
      <circle cx="18.5" cy="19.5" r="2.5" />
      <path d="M12 7v4.5M5.5 17v-2.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1V17" />
    </svg>
  );
}

/** The escrow. */
export function VaultIcon({ className, size = 22 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 8.2V6.5M12 17.5v-1.7M15.8 12h1.7M6.5 12h1.7" />
    </svg>
  );
}

/** The check-in clock. */
export function ClockIcon({ className, size = 22 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 1.9" />
    </svg>
  );
}

/** A withheld role bit. */
export function LockIcon({ className, size = 22 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
      <circle cx="12" cy="15.2" r="1.2" />
    </svg>
  );
}

/** A granted role bit. */
export function UnlockIcon({ className, size = 22 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 7.4-2.1" />
      <circle cx="12" cy="15.2" r="1.2" />
    </svg>
  );
}

/** An heir. */
export function HeirIcon({ className, size = 22 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <circle cx="9" cy="8.5" r="3.4" />
      <path d="M3 20c0-3.2 2.7-5.3 6-5.3s6 2.1 6 5.3" />
      <path d="M16.5 6.2a3.4 3.4 0 0 1 0 6.4M18 20c0-2.4-.7-4.1-2.2-5.1" />
    </svg>
  );
}

/** A signed attestation. */
export function ShieldIcon({ className, size = 22 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.2-7.5 9.5-4.4-1.3-7.5-4.9-7.5-9.5V6z" />
      <path d="M9 12.2l2.2 2.2 4-4.3" />
    </svg>
  );
}

/** A completed step. */
export function CheckIcon({ className, size = 22 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

export function ArrowRightIcon({ className, size = 18 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

export function PlusIcon({ className, size = 18 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TrashIcon({ className, size = 18 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.5 7l.8 12a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.8-12" />
    </svg>
  );
}

/** Fast-forwarding the demo clock. */
export function FastForwardIcon({ className, size = 18 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M3 6l8 6-8 6zM13 6l8 6-8 6z" />
    </svg>
  );
}

export function AlertIcon({ className, size = 22 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M12 4.5L21 19.5H3z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

export function WalletIcon({ className, size = 18 }: IconProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" />
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M16 14h2" />
    </svg>
  );
}
