import {
  CheckedIn,
  EnteredGrace,
  EstateConfigured,
  Unlocked,
} from "../generated/HeritRegistry/HeritRegistry";
import { activity } from "./activity";

export function handleEstateConfigured(event: EstateConfigured): void {
  const row = activity(event, event.params.estateId, "EstateConfigured");
  if (row == null) return;
  row.checkInInterval = event.params.checkInInterval;
  row.graceDuration = event.params.graceDuration;
  row.save();
}

export function handleCheckedIn(event: CheckedIn): void {
  const row = activity(event, event.params.estateId, "CheckedIn");
  if (row == null) return;
  row.save();
}

/** Emitted by the poke that notices the lapse, so it is stamped then, not when grace began. */
export function handleEnteredGrace(event: EnteredGrace): void {
  const row = activity(event, event.params.estateId, "EnteredGrace");
  if (row == null) return;
  row.save();
}

export function handleUnlocked(event: Unlocked): void {
  const row = activity(event, event.params.estateId, "Unlocked");
  if (row == null) return;
  row.count = event.params.heirCount;
  row.save();
}
