import { ClaimView } from "@/components/claim/claim-view";
import { firstParam, nowSeconds } from "@/lib/estate";

export default async function ClaimPage({ searchParams }: PageProps<"/claim">) {
  const { estate, heir } = await searchParams;

  return (
    <div className="mx-auto max-w-6xl">
      <ClaimView
        now={nowSeconds()}
        requestedEstate={firstParam(estate)}
        requestedHeir={firstParam(heir)}
      />
    </div>
  );
}
