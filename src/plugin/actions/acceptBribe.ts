import { Action, ActionExample, composeContext, elizaLogger, generateObjectDeprecated, HandlerCallback, IAgentRuntime, Memory, ModelClass, State } from "@elizaos/core";
import { ethers } from "ethers";
import { bribes, poolInfo } from "../../adapter/bribeAdapter";
import BribeAdapter from "../../adapter/bribeAdapter.ts";
import { date, z } from "zod";

const diamondAbi = [
  {
    inputs: [],
    name: "getNumberOfPools",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "poolId",
        type: "uint256",
      },
    ],
    name: "getPoolData",
    outputs: [
      {
        internalType: "uint256",
        name: "stakedBudsVolume",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "noOfStakers",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "currentPooledRewards",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    "inputs": [],
    "name": "getCurrentEpoch",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];


// Schema for validating bribe details
const bribeMsgSchema = z.object({
  pool: z.string().min(1),
  userAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  chain: z.enum(["berachainBartio", "polygon", "monad"]),
});

// Template for extracting bribe details
const bribeMsgTemplate = `Look at your LAST RESPONSE in the conversation where you sent details to users for sending $BUDS bribe to you.
Based on ONLY that last message, extract the bribe details:

Bribe details must include chain, userAddress, and pool. For example:
- For "Send your $BUDS to \n0xF102DCb813DBE6D66a7101FA57D2530632ab9C9C, \ntime limit - 5 mins \nfrom- 0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1 \nchain - berachainBartio \n for- bakeland" -> use "bakeland" as pool & "berachainBartio" as chain & "0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1" as userAddress

- For "Send your bribe to \n0xF102DCb813DBE6D66a7101FA57D2530632ab9C9C, \ntime limit - 5 mins \nfrom- 0x1502e497B95e7B01D16C9C4C8193E6C2636f98C2 \nchain - polygon \n for- yeetard" -> use "yeetard" as pool & "polygon" as chain & "0x1502e497B95e7B01D16C9C4C8193E6C2636f98C2" as userAddress

- For "waiting for your bribe to \n0xF102DCb813DBE6D66a7101FA57D2530632ab9C9C, \ntime limit - 5 mins \nfrom- 0x1502e497B95e7B01D16C9C4C8193E6C2636f98C2 \nchain - monad \n for- deadpool" -> use "deadpool" as pool & "monad" as chain & "0x1502e497B95e7B01D16C9C4C8193E6C2636f98C2" as userAddress

\`\`\`json
{
    "pool": "<pool>",
    "userAddress": "<userAddress>",
    "chain": "<chain>",
}
\`\`\`

Recent conversation:
{{recentMessages}}`;


const generateSuccessMessage = (amount: bigint, userAddress: string, chain: string, pool: string) => ({
  text: `Success! Received your bribe of ${amount.toString()} $BUDS from ${userAddress} for pool ${pool} on ${chain}.`,
});

const generateFailureMessage = () => ({
  text: `Sorry, I didn't receive your bribe within the time limit. Please try again.`,
});

// Helper function to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const acceptBribe: Action = {
  name: "ACCEPT_BRIBE",
  similes: ["TAKE_BRIBE", "GIVING_BRIBE", "BRIBING_FOR", "WANT_TO_BRIBE"],
  description: "Bribing agent for competing and getting rewards in form of buybacks, giveaways",
  suppressInitialMessage: true,
  validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    return !!(runtime.getSetting("WALLET_PRIVATE_KEY") && runtime.getSetting("ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO"));
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, _options: Record<string, unknown>, callback?: HandlerCallback): Promise<boolean> => {
    let content;
    try {
      elizaLogger.info("Entered ACCEPT_BRIBE action", { state, message });

      // Compose state and generate bribe details
      state = !state ? await runtime.composeState(message) : await runtime.updateRecentMessageState(state);
      const context = composeContext({ state, template: bribeMsgTemplate });

      content = await generateObjectDeprecated({
        runtime,
        context: context,
        modelClass: ModelClass.SMALL,
      });

      // Validate bribe details
      const parseResult = bribeMsgSchema.safeParse(content);
      if (!parseResult.success) {
        throw new Error(`Invalid bribe message content: ${JSON.stringify(parseResult.error.errors, null, 2)}`);
      }

      const adapter = new BribeAdapter();

      const ts = Date.now();

      // saving the bribe in temporary bribe pool [mempool]
      await adapter.saveBribeToMemPool(runtime, content.userAddress, content.chain, content.pool, ts);

      if (callback) {
        callback({
          text: `Waiting for bribe from ${content.userAddress} on ${content.chain} for ${content.pool} send it within 6 mins & 9 seconds to 0xf102dcb813dbe6d66a7101fa57d2530632ab9c9c`,
       });
      }

      return true;

    } catch (error) {
      elizaLogger.error("Error accepting bribe:", {
        content,
        message: error.message,
        code: error.code,
      });
      if (callback) {
        callback({
          text: `Error accepting bribe: ${error.message}`,
        });
      }
      return false;
    }
  },
  examples: [
    
  ] as ActionExample[][],
} as Action;

export default acceptBribe;
