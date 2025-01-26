import type {Plugin} from "@elizaos/core";
import acceptBribe from "./actions/acceptBribe.ts";
import {registerPool} from "./actions/RegisterPool.ts";

// Export the plugin configuration
export const bakelandPlugin: Plugin = {
  name: "bakeland",
  description: "bakeland plugin",
  actions: [acceptBribe, registerPool],
  evaluators: [],
  providers: [],
};

export default bakelandPlugin;
