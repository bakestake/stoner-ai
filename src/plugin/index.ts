import type {Plugin} from "@elizaos/core";
import acceptBribe from "./actions/acceptBribe.ts";
import {registerPool} from "./actions/RegisterPool.ts";
import finalizeRound from "./actions/finalizeRound.ts";
import { claimBuyBack } from "./actions/claimBuyBack.ts";
import deletePool from "./actions/deletePool.ts";

// Export the plugin configuration
export const bakelandPlugin: Plugin = {
  name: "bakeland",
  description: "bakeland plugin",
  actions: [acceptBribe, registerPool, finalizeRound, claimBuyBack, deletePool],
  evaluators: [],
  providers: [],
};

export default bakelandPlugin;
