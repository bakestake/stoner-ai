import {Action, ActionExample, composeContext, elizaLogger, generateObjectDeprecated, HandlerCallback, IAgentRuntime, Memory, ModelClass, State} from "@elizaos/core";
import {Address} from "viem";
import {z} from "zod";
import {ethers} from "ethers";

const bribeMsgSchema = z.object({
  pool: z.string().min(1).toUpperCase(),
  userAddress: z.string().min(1).toUpperCase(),
  chain: z.string().toLowerCase().min(1),
});

const verifyMsgSchema = z.object({
  userAddress: z.string().min(1).toUpperCase(),
});

const verifyMsgTemplate = `Look at user's LAST MESSAGE in the conversation where you sent details to your to send the bribe.
Based on ONLY LAST message, extract the receiption details:

receiption details must include chain, userAddress, and pool. For example:
- For "Send you $BUDS to \n0xF102DCb813DBE6D66a7101FA57D2530632ab9C9C, \ntime limit - 5 mins \nfrom- 0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1 \nchain - berachainBartio \n for- bakeland" -> use "bakeland" as pool & "berachainBartio" as chain & "0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1" as userAddress

- For "Send you $BUDS to \n0xF102DCb813DBE6D66a7101FA57D2530632ab9C9C, \ntime limit - 5 mins \nfrom- 0x55CC1e9b2CB571957b1F6Cd0972543d7Af00d72e \nchain - berachainBartio \n for- yeetards" -> use "yeetards" as pool & "berachainBartio" as chain & "0x55CC1e9b2CB571957b1F6Cd0972543d7Af00d72e" as userAddress


\`\`\`json
{
    "pool": "<pool>",
    "userAddress": "<userAddress>",
    "chain": "<chain>",
}
\`\`\`

Recent conversation:
{{recentMessages}}`;

const bribeMsgTemplate = `Look at your LAST MESSAGE in the conversation where you sent details to your to send the bribe.
Based on ONLY LAST message, extract the receiption details:

receiption details must include chain, userAddress, and pool. For example:
- For "Send you $BUDS to \n0xF102DCb813DBE6D66a7101FA57D2530632ab9C9C, \ntime limit - 5 mins \nfrom- 0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1 \nchain - berachainBartio \n for- bakeland" -> use "bakeland" as pool & "berachainBartio" as chain & "0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1" as userAddress

- For "Send you $BUDS to \n0xF102DCb813DBE6D66a7101FA57D2530632ab9C9C, \ntime limit - 5 mins \nfrom- 0x55CC1e9b2CB571957b1F6Cd0972543d7Af00d72e \nchain - berachainBartio \n for- yeetards" -> use "yeetards" as pool & "berachainBartio" as chain & "0x55CC1e9b2CB571957b1F6Cd0972543d7Af00d72e" as userAddress


\`\`\`json
{
    "pool": "<pool>",
    "userAddress": "<userAddress>",
    "chain": "<chain>",
}
\`\`\`

Recent conversation:
{{recentMessages}}`;

export const verifyBribe: Action = {
  name: "VERIFY_BRIBE",
  similes: ["CHECK_BRIBE", "VALIDATE_BRIBE", "HAVE_YOU_RECEIVED_BRIBE"],
  description: "Verifies received bribes",
  validate: async (runtime: IAgentRuntime) => {
    return !!(runtime.getSetting("WALLET_PRIVATE_KEY") && runtime.getSetting("ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO"));
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, _options: Record<string, unknown>, callback?: HandlerCallback): Promise<boolean> => {
    let content;
    try {
      console.log("ENTERED VERIFY BRIBE ACTION");
      state = !state ? await runtime.composeState(message) : await runtime.updateRecentMessageState(state);

      const context = composeContext({
        state,
        template: bribeMsgTemplate,
      });

      content = await generateObjectDeprecated({
        runtime,
        context,
        modelClass: ModelClass.SMALL,
      });

      const parseResult = bribeMsgSchema.safeParse(content);
      if (!parseResult.success) {
        throw new Error(`Invalid bribe message content: ${JSON.stringify(parseResult.error.errors, null, 2)}`);
      }
      const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO);

      // ERC-20 token contract address
      const tokenAddress = process.env.BUDS_ADDRESS;
      // ABI to interact with ERC-20 contract (minimum required to interact with events)
      const abi = ["event Transfer(address indexed from, address indexed to, uint256 value)"];

      // Create contract instance
      const tokenContract = new ethers.Contract(tokenAddress, abi, provider);

      // Sender and recipient addresses
      const fromAddress = content.userAddress;
      const toAddress = "0xf102dcb813dbe6d66a7101fa57d2530632ab9c9c";
      let amount;
      let i = 0;
      let fromBlock = await provider.getBlockNumber();
      const filter = tokenContract.filters.Transfer(fromAddress, toAddress);

      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      while (i < 10 && amount == null) {
        await delay(30000); // Wait for 30 seconds
        const currentBlock = await provider.getBlockNumber();
        const events = await tokenContract.queryFilter(filter, fromBlock, currentBlock);
        if (events.length > 0) {
          events.forEach((event) => {
            console.log(`${event.data}`);
            amount = event.data;
          });
          return true;
        }
        fromBlock = currentBlock;
        i++;
      }

      // store the bribe info in following manner

      //

      if (callback) {
        callback({
          text: `Received bribe from \nfrom- 0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1 \nchain- berachain bartio \nfor - bakeland pool`,
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
          text: "verify bribe from 0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "Received bribe from \nfrom- 0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1 \nchain- berachain bartio \nfor - bakeland pool",
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
