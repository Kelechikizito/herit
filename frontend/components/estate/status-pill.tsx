import { type EstateStatus, STATUS_COPY } from "@/lib/estate";

/** The estate's state, as a pill. The dot pulses in grace — the one state that is still moving. */
export function StatusPill({
  status,
  size = "md",
}: {
  status: EstateStatus;
  size?: "sm" | "md";
}) {
  const copy = STATUS_COPY[status];

  return (
    <span
      className={`tag tag-shadow ${copy.color} ${
        size === "sm" ? "px-2.5 py-1 text-[0.7rem]" : ""
      } ${status === "unlocked" ? "text-white" : ""}`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full border border-ink ${
          status === "unlocked" ? "bg-white" : "bg-ink"
        } ${status === "grace" ? "pulse-dot" : ""}`}
        aria-hidden="true"
      />
      {copy.label}
    </span>
  );
}
