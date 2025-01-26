import {Action, composeContext, elizaLogger, generateObjectDeprecated, HandlerCallback, IAgentRuntime, Memory, ModelClass, State} from "@elizaos/core";
import {bigint, z} from "zod";
import {BribeAdpater, poolInfo} from "../../adapter/BribeAdpater";
import {ethers} from "ethers";
import {diamondAbi} from "../../../artifacts/diamondAbi";

const poolMsgSchema = z.object({
  id: z.number().min(1),
  name: z.string().min(1).toUpperCase(),
  chain: z.string().toLowerCase().min(1),
  pooledBribes: z.bigint(),
});

const poolMsgTemplate = `Look at user's FIRST RESPONSE in the conversation where user sent message to register pool.
Based on ONLY that first message, extract the details:

Details must include chain. For example:
- For "Register new pool on berachain" ->"berachain" as chain

- For "Add new pool on  polygon" -> "polygon" as chain

\`\`\`json
{
    "chain": "<chain>",
}
\`\`\`

Recent conversation:
{{recentMessages}}`;

export const registerPool: Action = {
  name: "REGISTER_POOL",
  similes: ["ADD_POOL"],
  description: "Adding pools",
  suppressInitialMessage: true,
  validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    return !!(runtime.getSetting("WALLET_PRIVATE_KEY") && runtime.getSetting("ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO"));
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

      elizaLogger.log(content.name);

      const bribeAdapter = new BribeAdpater();

      const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO);
      const diamond = new ethers.Contract(process.env.DIAMOND_ADDRESS, diamondAbi, provider);
      const noOfPools = await diamond.getNumberOfPools();

      for (let i = 1; i <= noOfPools; i++) {
        const poolData = await diamond.getPoolData(i);
        const exists = await bribeAdapter.isPoolRegistered(runtime, poolData.name);
        if (!exists) {
          const poolInfo: poolInfo = {name: poolData.name, id: i, chain: content.chain, pooledBribes: BigInt(0)};
          await bribeAdapter.registerPool(runtime, poolInfo);
          if (callback) {
            callback({
              text: `Registered pool : ${poolData.name} with id ${i}`,
            });
          }
        }
      }

      return true;
    } catch (error) {
      elizaLogger.error("Error accepting bribe:", {
        message: error.message,
        code: error.code,
      });
      if (callback) {
        callback({
          text: `Error accepting bribe: ${error.message}`,
          content: {error: error.message},
        });
      }
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Register new pool on berachain",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "Ok, lemme registere new pools listed on bakeland on the berachain",
          action: "REGISTER_POOL",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Add new pool on polygon",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "adding new pools listed on bakeland on the polygon",
          action: "REGISTER_POOL",
        },
      },
    ],
  ],
};
