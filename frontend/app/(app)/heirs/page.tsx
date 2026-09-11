import { HeirsView } from "@/components/heirs/heirs-view";
import { firstParam, nowSeconds } from "@/lib/estate";

export default async function HeirsPage({ searchParams }: PageProps<"/heirs">) {
  const { estate } = await searchParams;

  // The estates table counts down; the client ticks on from this via `useNow`.
  const now = nowSeconds();

  return (
    <div className="mx-auto max-w-6xl">
      <HeirsView now={now} requestedEstate={firstParam(estate)} />
    </div>
  );
}
