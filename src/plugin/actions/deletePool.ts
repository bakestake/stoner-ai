import {Action, elizaLogger, IAgentRuntime, Memory, State, HandlerCallback, composeContext, generateObjectDeprecated, ModelClass} from "@elizaos/core";
import {ethers} from "ethers";
import BribeAdapter from "../../adapter/bribeAdapter.ts";
import {diamondAbi} from "../../../artifacts/diamondAbi.ts";
import { z } from "zod";

const poolMsgSchema = z.object({
  chain: z.string().toLowerCase().min(1),
});

const poolMsgTemplate = `Look at user's FIRST MESSAGE in the conversation where user sent message to delete pool.
Based on ONLY that first message, extract the details:

Details must include chain. For example:
- For "Delete blacklisted pools on berachain" -> "berachain" as chain
- For "Remove blacklisted pools from polygon" -> "polygon" as chain

\`\`\`json
{
    "chain": "<chain>"
}
\`\`\`

Recent conversation:
{{recentMessages}}`;

export const deletePool: Action = {
  name: "DELETE_POOL",
  similes: ["REMOVE_POOL", "BLACKLIST_POOL"],
  description: "Deletes blacklisted pools from the database",
  suppressInitialMessage: true,
  validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    return !!(runtime.getSetting("WALLET_PRIVATE_KEY") && runtime.getSetting("DIAMOND_ADDRESS") && runtime.getSetting("ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO"));
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, _options: Record<string, unknown>, callback?: HandlerCallback): Promise<boolean> => {
    try {
        elizaLogger.log("ENTERED ACTION");
        state = !state ? await runtime.composeState(message) : await runtime.updateRecentMessageState(state);
  
        const context = composeContext({
          state,
          template: poolMsgTemplate,
        });
  
        let content = await generateObjectDeprecated({
          runtime,
          context: context,
          modelClass: ModelClass.SMALL,
        });
  
        const parseResult = poolMsgSchema.safeParse(content);
        if (!parseResult.success) {
          throw new Error(`Invalid bribe message content: ${JSON.stringify(parseResult.error.errors, null, 2)}`);
        }
  
        elizaLogger.log(content.chain);

      // Initialize contracts and adapter
      const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO);
      const bakelandContract = new ethers.Contract(process.env.DIAMOND_ADDRESS, diamondAbi, provider);
      const adapter = new BribeAdapter();

      // Get total number of pools
      const numberOfPools = await bakelandContract.getNumberOfPools();
      elizaLogger.info(`Total number of pools: ${numberOfPools}`);

      let deletedPools = 0;

      // Iterate through all pools
      for (let i = 1; i <= numberOfPools; i++) {
        try {
                    
          // Check if pool is blacklisted
          if (await bakelandContract.isWhitelistedPoolById(i)) {
            elizaLogger.info(`Found blacklisted pool with ID: ${i}`);
            
            // Delete pool from database if it exists
            const deleted = await adapter.deletePool(runtime, i);
            if (deleted) {
              deletedPools++;
              elizaLogger.info(`Successfully deleted pool ${i} from database`);
            }
          }
        } catch (error) {
          elizaLogger.error(`Error processing pool ${i}:`, {
            message: error.message,
            code: error.code
          });
          continue; // Continue with next pool even if current one fails
        }
      }

      if (callback) {
        callback({
          text: `Pool cleanup completed. Deleted ${deletedPools} blacklisted pools.`
        });
      }

      return true;

    } catch (error) {
      elizaLogger.error("Error in DELETE_POOL action:", {
        message: error.message,
        code: error.code
      });
      
      if (callback) {
        callback({
          text: `Error deleting pools: ${error.message}`
        });
      }
      
      return false;
    }
  },
  examples: []
} as Action;

export default deletePool;
