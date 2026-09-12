import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { ActivityEvent, Estate } from "../generated/schema";

/** Wider than any block's log count, so one block's sequence numbers never run into the next's. */
const LOGS_PER_BLOCK = BigInt.fromI32(1000000);

/**
 * The activity row for one event, with the fields every kind shares filled in. The caller adds
 * the kind-specific fields and saves.
 *
 * Null for an estate the gate never opened. Every herit write is gated on an open estate, so this
 * is defensive: a row pointing at a missing `Estate` would break any query that follows the link.
 */
export function activity(event: ethereum.Event, estateId: BigInt, kind: string): ActivityEvent | null {
  const estate = estateId.toString();
  if (Estate.load(estate) == null) {
    log.warning("{} for estate {}, which was never opened: skipped", [kind, estate]);
    return null;
  }

  const row = new ActivityEvent(event.transaction.hash.concatI32(event.logIndex.toI32()));
  row.estate = estate;
  row.kind = kind;
  row.sequence = event.block.number.times(LOGS_PER_BLOCK).plus(event.logIndex);
  row.blockNumber = event.block.number;
  row.timestamp = event.block.timestamp;
  row.txHash = event.transaction.hash;
  return row;
}
