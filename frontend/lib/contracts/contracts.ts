import { accessControlGateAbi } from "@/lib/contracts/abis/accessControlGate.abi";
import { claimManagerAbi } from "@/lib/contracts/abis/claimManager.abi";
import { grantorRegistryAbi, labelStoreAbi } from "@/lib/contracts/abis/ens";
import { heritRegistryAbi } from "@/lib/contracts/abis/heritRegistry.abi";
import { heritVaultAbi } from "@/lib/contracts/abis/heritVault.abi";
import { livenessAttestorAbi } from "@/lib/contracts/abis/livenessAttestor.abi";
import { ens, herit } from "@/lib/contracts/addresses";

export const contracts = {
  accessControlGate: { address: herit.accessControlGate, abi: accessControlGateAbi },
  heritRegistry: { address: herit.heritRegistry, abi: heritRegistryAbi },
  heritVault: { address: herit.heritVault, abi: heritVaultAbi },
  claimManager: { address: herit.claimManager, abi: claimManagerAbi },
  livenessAttestor: { address: herit.livenessAttestor, abi: livenessAttestorAbi },
  grantorRegistry: { address: ens.grantorRegistry, abi: grantorRegistryAbi },
  labelStore: { address: ens.labelStore, abi: labelStoreAbi },
} as const;
