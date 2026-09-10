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
