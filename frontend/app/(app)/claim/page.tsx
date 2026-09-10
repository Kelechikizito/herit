import { ClaimView } from "@/components/claim/claim-view";
import { nowSeconds } from "@/lib/estate";

export default function ClaimPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ClaimView now={nowSeconds()} />
    </div>
  );
}
