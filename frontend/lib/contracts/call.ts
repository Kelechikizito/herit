import type {
  Abi,
  Address,
  ContractFunctionArgs,
  ContractFunctionName,
  ContractFunctionParameters,
} from "viem";

/**
 * One contract call, checked against its ABI where it is written.
 *
 * Split out of `use-transaction` so a module that only describes calls — the setup plan — can spell
 * one without importing a client hook.
 */

/** Writes only. Anything free to call is a read, and reads go through wagmi's hooks. */
export type Mutability = "nonpayable" | "payable";

/**
 * Address, ABI, function and arguments, checked against each other at the call site. viem's shape
 * rather than wagmi's: wagmi's per-chain parameter union is too large for TypeScript to carry
 * through a generic callback.
 */
export type TxRequest<
  abi extends Abi,
  functionName extends ContractFunctionName<abi, Mutability>,
  args extends ContractFunctionArgs<abi, Mutability, functionName>,
> = ContractFunctionParameters<abi, Mutability, functionName, args> & { value?: bigint };

/**
 * A call whose arguments have already been checked, widened so calls to different functions can sit
 * in one list. Build one with `contractCall`; never write this shape out by hand, which is exactly
 * the check it exists to keep.
 */
export type ContractCall = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

/** Checks a call against its ABI, then widens it. The type-checking happens here, at the call site. */
export function contractCall<
  const abi extends Abi,
  functionName extends ContractFunctionName<abi, Mutability>,
  const args extends ContractFunctionArgs<abi, Mutability, functionName>,
>(request: TxRequest<abi, functionName, args>): ContractCall {
  return request as unknown as ContractCall;
}
