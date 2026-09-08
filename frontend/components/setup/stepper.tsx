import { CheckIcon } from "@/components/ui/icons";
import { IconCircle } from "@/components/ui/icon-circle";
import { SETUP_STEPS } from "@/lib/content/setup";

/** The four setup steps, each jumpable — nothing is committed until the last one. */
export function Stepper({
  current,
  onJump,
}: {
  current: number;
  onJump: (step: number) => void;
}) {
  return (
    <ol className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SETUP_STEPS.map((step, index) => {
        const state = index < current ? "done" : index === current ? "active" : "todo";
        return (
          <li key={step.title}>
            <button
              type="button"
              onClick={() => onJump(index)}
              className={`flex w-full items-center gap-2.5 rounded-[8px] border-2 border-ink px-3 py-2.5 text-left ${
                state === "active"
                  ? "bg-yellow shadow-brut"
                  : state === "done"
                    ? "bg-teal"
                    : "bg-surface"
              }`}
              aria-current={state === "active" ? "step" : undefined}
            >
              <IconCircle size="sm">
                {state === "done" ? <CheckIcon size={14} /> : <step.icon size={20} />}
              </IconCircle>
              <span className="min-w-0">
                <span className="mono block text-[0.65rem] font-bold text-muted">
                  0{index + 1}
                </span>
                <span className="block truncate text-sm font-bold">{step.title}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
