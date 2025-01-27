import {Action, ActionExample, composeContext, elizaLogger, generateObjectDeprecated, HandlerCallback, IAgentRuntime, Memory, ModelClass, State} from "@elizaos/core";
import {ethers} from "ethers";
import {z} from "zod";
import {BribeAdpater, bribes} from "../../adapter/BribeAdpater";
import {diamondAbi} from "../../../artifacts/diamondAbi";

// Schema for validating bribe details
const bribeMsgSchema = z.object({
  pool: z.string().min(1).toUpperCase(),
  userAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
    .toUpperCase(),
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

// Helper function to generate callback messages
const generateConfirmationMessage = (userAddress: string, chain: string, pool: string) => ({
  text: `Got it! I'm waiting for your $BUDS bribe to \n0xF102DCb813DBE6D66a7101FA57D2530632ab9C9C, \ntime limit - 5 mins \nfrom- ${userAddress} \nchain - ${chain} \n for- ${pool}.`,
});

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
      elizaLogger.info("Entered ACCEPT_BRIBE action", {state, message});

      // Compose state and generate bribe details
      state = !state ? await runtime.composeState(message) : await runtime.updateRecentMessageState(state);
      const context = composeContext({state, template: bribeMsgTemplate});

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

      // Send confirmation message
      if (callback) {
        callback(generateConfirmationMessage(content.userAddress, content.chain, content.pool));
      }

      elizaLogger.info("Parsed bribe details", {content});

      // Initialize Ethereum provider and contract
      const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO);
      const tokenAddress = process.env.BUDS_ADDRESS;
      const abi = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
      const tokenContract = new ethers.Contract(tokenAddress, abi, provider);
      const bakelandContract = new ethers.Contract(process.env.DIAMOND_ADDRESS, diamondAbi, provider);

      const fromAddress = content.userAddress;
      const toAddress = "0xf102dcb813dbe6d66a7101fa57d2530632ab9c9c";

      // Poll for Transfer events
      let amount: bigint | null = null;
      const startBlock = await provider.getBlockNumber();
      const endTime = Date.now() + 300000; // 5 minutes timeout
      let currentBlock = startBlock;

      while (Date.now() < endTime) {
        const latestBlock = await provider.getBlockNumber();
        if (latestBlock > currentBlock) {
          const filter = tokenContract.filters.Transfer(fromAddress, toAddress);
          const events = await tokenContract.queryFilter(filter, currentBlock, latestBlock);

          if (events.length > 0) {
            const event = events[0];
            const logs = tokenContract.interface.parseLog(event);
            amount = logs.args[2];
            break; // Exit loop if bribe is detected
          }

          currentBlock = latestBlock;
        }

        await delay(15000); // Poll every 15 seconds
      }

      if (!amount) {
        if (callback) {
          callback(generateFailureMessage());
        }
        return false;
      }

      // Save bribe data in the database
      const adapter = new BribeAdpater();
      const pool = await adapter.getPoolByName(runtime, content.pool);
      if (!pool) {
        throw new Error(`Pool ${content.pool} not found.`);
      }

      const bribeData: bribes = {
        poolName: content.pool,
        pool: pool.id,
        amount: amount,
        address: fromAddress,
        chain: content.chain,
        epoch: await bakelandContract.getCurrentEpoch(),
      };
      await adapter.saveOrUpdateBribe(runtime, bribeData);

      // Notify user of successful bribe
      if (callback) {
        callback(generateSuccessMessage(amount, content.userAddress, content.chain, content.pool));
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
    [
      {
        user: "{{user1}}",
        content: {
          text: "accept bribe for bakeland pool on berachainBartio from 0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "Send you $BUDS to \n0xF102DCb813DBE6D66a7101FA57D2530632ab9C9C, \ntime limit - 5 mins \nfrom- 0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1 \nchain - berachainBartio \n for- bakeland",
          action: "ACCEPT_BRIBE",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "take my bribe for yeetard pool on polygon from 0x1502e497B95e7B01D16C9C4C8193E6C2636f98C2",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "Send your $BUDS to \n0xF102DCb813DBE6D66a7101FA57D2530632ab9C9C, \ntime limit - 5 mins \nfrom- 0x1502e497B95e7B01D16C9C4C8193E6C2636f98C2 \nchain - polygon \n for- yeetard",
          action: "ACCEPT_BRIBE",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "sending you a bribe for deadpool pool on monad from 0x1502e497B95e7B01D16C9C4C8193E6C2636f98C2",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "waiting for your bribe to \n0xF102DCb813DBE6D66a7101FA57D2530632ab9C9C, \ntime limit - 5 mins \nfrom- 0x1502e497B95e7B01D16C9C4C8193E6C2636f98C2 \nchain - monad \n for- deadpool",
          action: "ACCEPT_BRIBE",
        },
      },
    ],
  ] as ActionExample[][],
} as Action;

export default acceptBribe;
