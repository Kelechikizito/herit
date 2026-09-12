import { shortAddress } from "@/lib/estate";
import type { Resolution } from "@/lib/wagmi/use-resolved-address";
import { FormField } from "./form-field";
import { AlertIcon, CheckIcon } from "./icons";

/**
 * An address field that also takes an ENS name.
 *
 * Presentational: the caller owns the text and runs `useResolvedAddress` over it, because the same
 * resolution decides what the form submits. All this adds is the line under the input showing what
 * the typed name resolved to — the grantor confirms the address before it is minted, rather than
 * trusting a name they cannot check.
 */
export function AddressField({
  id,
  label,
  hint,
  placeholder = "0x… or son.alice.herit.eth",
  className = "",
  value,
  onChange,
  resolution,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  placeholder?: string;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  resolution: Resolution;
}) {
  return (
    <FormField id={id} label={label} hint={hint} className={className}>
      <input
        id={id}
        className="input mono"
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-resolution`}
      />
      <p id={`${id}-resolution`} aria-live="polite">
        <ResolutionLine resolution={resolution} />
      </p>
    </FormField>
  );
}

function ResolutionLine({ resolution }: { resolution: Resolution }) {
  switch (resolution.kind) {
    case "resolving":
      return (
        <span className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full border-2 border-ink bg-yellow" />
          <span className="mono">resolving {resolution.name}…</span>
        </span>
      );

    case "resolved":
      return (
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-bold">
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-ink bg-teal">
            <CheckIcon size={12} />
          </span>
          <span className="mono">{resolution.name}</span>
          <span className="text-muted">→</span>
          <span className="mono">{shortAddress(resolution.address)}</span>
        </span>
      );

    case "unresolved":
      return (
        <span className="mt-1.5 flex items-start gap-1.5 text-xs font-bold text-coral">
          <AlertIcon size={14} />
          {resolution.reason}
        </span>
      );

    default:
      return null;
  }
}
