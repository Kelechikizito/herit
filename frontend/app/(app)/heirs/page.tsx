import { HeirsView } from "@/components/heirs/heirs-view";
import { firstParam, nowSeconds } from "@/lib/estate";

export default async function HeirsPage({ searchParams }: PageProps<"/heirs">) {
  const { estate } = await searchParams;

  return (
    <div className="mx-auto max-w-6xl">
      <HeirsView now={nowSeconds()} requestedEstate={firstParam(estate)} />
    </div>
  );
}
