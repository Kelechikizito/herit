import type { ComponentType } from "react";
import {
  ClockIcon,
  HeirIcon,
  type IconProps,
  TreeIcon,
  VaultIcon,
} from "@/components/ui/icons";

/** Copy for the four-step estate setup wizard. */

type Icon = ComponentType<IconProps>;

export const SETUP_STEPS: readonly { title: string; icon: Icon }[] = [
  { title: "your name", icon: TreeIcon },
  { title: "the clock", icon: ClockIcon },
  { title: "your heirs", icon: HeirIcon },
  { title: "fund it", icon: VaultIcon },
];

/** What claiming an estate name actually does, shown beside the label field. */
export const NAME_STEP_FACTS: readonly { title: string; body: string }[] = [
  {
    title: "registry B",
    body: "deployed for your estate at an address derivable before it exists",
  },
  {
    title: "you own the name",
    body: "herit is denied ROLE_UNREGISTER and ROLE_CAN_TRANSFER_ADMIN",
  },
  {
    title: "heirs live underneath",
    body: "each one a subname, each one permissioned separately",
  },
];

/** The final review panel. Placeholder values until the wizard tracks real input. */
export const SETUP_REVIEW: readonly { label: string; value: string }[] = [
  { label: "estate name", value: "alice.herit.eth" },
  { label: "check-in interval", value: "30 days" },
  { label: "grace period", value: "7 days" },
  { label: "unlocks after", value: "37 days" },
  { label: "heirs", value: "3 subnames" },
  { label: "allocated", value: "90%" },
  { label: "vault deposit", value: "12.4 ETH" },
];

/** Defaults the wizard opens with. */
export const SETUP_DEFAULTS = {
  estateLabel: "alice",
  interval: "30 days",
  grace: "7 days",
  unlocksAfter: "37 days",
  depositEth: 12.4,
} as const;
