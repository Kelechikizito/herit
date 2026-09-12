import { CheckInAttested, ClaimAttested } from "../generated/LivenessAttestor/LivenessAttestor";
import { activity } from "./activity";

export function handleCheckInAttested(event: CheckInAttested): void {
  const row = activity(event, event.params.estateId, "CheckInAttested");
  if (row == null) return;
  row.account = event.params.subject;
  row.save();
}

export function handleClaimAttested(event: ClaimAttested): void {
  const row = activity(event, event.params.estateId, "ClaimAttested");
  if (row == null) return;
  row.heirLabelhash = event.params.heirLabelhash;
  row.account = event.params.subject;
  row.save();
}
