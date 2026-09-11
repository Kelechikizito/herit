import { DashboardView } from "@/components/dashboard/dashboard-view";
import { firstParam, nowSeconds } from "@/lib/estate";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { estate } = await searchParams;

  // One timestamp for the whole render, so no two cards disagree about what second it is. The
  // client ticks on from here via `useNow`.
  const now = nowSeconds();

  return (
    <div className="mx-auto max-w-6xl">
      <DashboardView now={now} requestedEstate={firstParam(estate)} />
    </div>
  );
}
