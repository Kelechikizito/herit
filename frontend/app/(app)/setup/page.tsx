import { SetupWizard } from "@/components/setup/setup-wizard";
import { Sparkle, Star } from "@/components/ui/deco";

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="relative text-center">
        <Star className="left-[6%] top-0 hidden deco-spin sm:block" size={30} fill="#FFE566" />
        <Sparkle
          className="right-[8%] top-2 hidden sm:block"
          size={24}
          fill="#7B6CF6"
          rotate={16}
        />
        <p className="text-[0.72rem] font-bold tracking-wide text-muted">estate setup</p>
        <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">open an estate</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted">
          four steps. the last one starts your check-in clock, so nothing is live until you
          pass a selfie check at the end.
        </p>
      </header>

      <SetupWizard />
    </div>
  );
}
