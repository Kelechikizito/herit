import { Deposited, Withdrawn } from "../generated/HeritVault/HeritVault";
import { activity } from "./activity";

export function handleDeposited(event: Deposited): void {
  const row = activity(event, event.params.estateId, "Deposited");
  if (row == null) return;
  row.token = event.params.token;
  row.account = event.params.from;
  row.amount = event.params.amount;
  row.save();
}

export function handleWithdrawn(event: Withdrawn): void {
  const row = activity(event, event.params.estateId, "Withdrawn");
  if (row == null) return;
  row.token = event.params.token;
  row.account = event.params.to;
  row.amount = event.params.amount;
  row.save();
}
