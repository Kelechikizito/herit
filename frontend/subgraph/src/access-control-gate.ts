import {
  EstateOpened,
  HeirRegistered,
  HeirUnlocked,
} from "../generated/AccessControlGate/AccessControlGate";
import { Estate } from "../generated/schema";
import { activity } from "./activity";

export function handleEstateOpened(event: EstateOpened): void {
  // Saved before the row, which refuses estates it cannot find.
  const estate = new Estate(event.params.estateId.toString());
  estate.label = event.params.label;
  estate.grantor = event.params.grantor;
  estate.estateRegistry = event.params.estateRegistry;
  estate.openedAt = event.block.timestamp;
  estate.save();

  const row = activity(event, event.params.estateId, "EstateOpened");
  if (row == null) return;
  row.account = event.params.grantor;
  row.save();
}

export function handleHeirRegistered(event: HeirRegistered): void {
  const row = activity(event, event.params.estateId, "HeirRegistered");
  if (row == null) return;
  row.heirLabelhash = event.params.heirLabelhash;
  row.account = event.params.heir;
  row.shareBps = event.params.shareBps;
  row.save();
}

export function handleHeirUnlocked(event: HeirUnlocked): void {
  const row = activity(event, event.params.estateId, "HeirUnlocked");
  if (row == null) return;
  row.heirLabelhash = event.params.heirLabelhash;
  row.account = event.params.heir;
  row.save();
}
