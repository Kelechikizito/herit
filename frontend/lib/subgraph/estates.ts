import type { Address } from "viem";
import { querySubgraph } from "./client";

/**
 * Every estate the gate has ever opened, from the indexer.
 *
 * The chain has no such list: `estatesOfGrantor` answers per wallet, which is all a grantor's own
 * screens need. Showing the whole deployment to a visitor who holds nothing is what the subgraph
 * is for.
 */

/** One estate as `EstateOpened` recorded it. */
export type OpenedEstate = {
  estateId: bigint;
  label: string;
  /**
   * Who opened it. Not necessarily who owns it now — a name can be transferred, or lapse — so
   * anything that turns on current ownership reads registry A instead.
   */
  grantor: Address;
  /** The estate's own ENSv2 registry, where its heir subnames live. */
  estateRegistry: Address;
  openedAt: number;
};

export type AllEstates = {
  /** Newest first. */
  estates: OpenedEstate[];
  /** The last block the indexer has processed. An estate opened after it is not here yet. */
  indexedBlock: number;
  hasIndexingErrors: boolean;
};

const ALL_ESTATES = `
  query AllEstates($first: Int!) {
    estates(orderBy: openedAt, orderDirection: desc, first: $first) {
      id
      label
      grantor
      estateRegistry
      openedAt
    }
    _meta {
      block {
        number
      }
      hasIndexingErrors
    }
  }
`;

/** As graph-node serialises it: `ID` and `BigInt` as decimal strings, `Bytes` as hex. */
type RawEstate = {
  id: string;
  label: string;
  grantor: Address;
  estateRegistry: Address;
  openedAt: string;
};

type RawAllEstates = {
  estates: RawEstate[];
  _meta: { block: { number: number }; hasIndexingErrors: boolean };
};

export async function fetchAllEstates(first: number, signal?: AbortSignal): Promise<AllEstates> {
  const data = await querySubgraph<RawAllEstates>(ALL_ESTATES, { first }, signal);

  return {
    estates: data.estates.map((raw) => ({
      // The entity id is the estate id, uint256(labelhash(label)), in decimal.
      estateId: BigInt(raw.id),
      label: raw.label,
      grantor: raw.grantor,
      estateRegistry: raw.estateRegistry,
      openedAt: Number(raw.openedAt),
    })),
    indexedBlock: data._meta.block.number,
    hasIndexingErrors: data._meta.hasIndexingErrors,
  };
}
