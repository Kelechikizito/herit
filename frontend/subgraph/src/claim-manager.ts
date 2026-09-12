import { ClaimSettled, Claimed } from "../generated/ClaimManager/ClaimManager";
import { activity } from "./activity";

/** One per token paid. The app folds these into the `ClaimSettled` row from the same transaction. */
export function handleClaimed(event: Claimed): void {
  const row = activity(event, event.params.estateId, "Claimed");
  if (row == null) return;
  row.heirLabelhash = event.params.heirLabelhash;
  row.account = event.params.heir;
  row.token = event.params.token;
  row.amount = event.params.amount;
  row.save();
}

export function handleClaimSettled(event: ClaimSettled): void {
  const row = activity(event, event.params.estateId, "ClaimSettled");
  if (row == null) return;
  row.heirLabelhash = event.params.heirLabelhash;
  row.account = event.params.heir;
  row.count = event.params.tokenCount;
  row.save();
}
