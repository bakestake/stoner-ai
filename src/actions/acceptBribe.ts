import {Action, ActionExample, composeContext, elizaLogger, generateObjectDeprecated, HandlerCallback, IAgentRuntime, Memory, ModelClass, State} from "@elizaos/core";
import {ethers} from "ethers";
import {z} from "zod";

export const bribeMsgSchema = z.object({
  pool: z.string().min(1).toUpperCase(),
  userAddress: z.string().min(1).toUpperCase(),
  chain: z.string().toLowerCase().min(1),
});

const bribeMsgTemplate = `Look at user's FIRST MESSAGE in the conversation where user requested you to accept bribe.
Based on ONLY that message, extract the bribe details:

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

export const acceptBribe: Action = {
  name: "ACCEPT_BRIBE",
  similes: ["TAKE_BRIBE", "GIVING_BRIBE", "BRIBING_FOR", "WANT_TO_BRIBE"],
  description: "Bribing agent for competing and getting rewards in form of buybacks, giveaways",
  validate: async (runtime: IAgentRuntime) => {
    return !!(runtime.getSetting("WALLET_PRIVATE_KEY") && runtime.getSetting("ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO"));
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, _options: Record<string, unknown>, callback?: HandlerCallback): Promise<boolean> => {
    let content;
    try {
      state = !state ? await runtime.composeState(message) : await runtime.updateRecentMessageState(state);

      const context = composeContext({
        state,
        template: bribeMsgTemplate,
      });

      content = await generateObjectDeprecated({
        runtime,
        context: context,
        modelClass: ModelClass.SMALL,
      });

      const parseResult = bribeMsgSchema.safeParse(content);
      if (!parseResult.success) {
        throw new Error(`Invalid bribe message content: ${JSON.stringify(parseResult.error.errors, null, 2)}`);
      }

      const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO);
      const tokenAddress = process.env.BUDS_ADDRESS;
      const abi = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
      const tokenContract = new ethers.Contract(tokenAddress, abi, provider);
      const fromAddress = content.userAddress;
      const toAddress = "0xf102dcb813dbe6d66a7101fa57d2530632ab9c9c";

      let amount;
      let i = 0;
      let fromBlock = await provider.getBlockNumber();
      const filter = tokenContract.filters.Transfer(fromAddress, toAddress);
      let iface = new ethers.Interface(abi);
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      while (i < 10 && amount == null) {
        await delay(30000); // Wait for 30 seconds
        const currentBlock = await provider.getBlockNumber();
        const events = await tokenContract.queryFilter(filter, fromBlock, currentBlock);
        if (events.length > 0) {
          events.forEach((event) => {
            console.log(`${event}`);
            const logs = iface.parseLog(event);
            console.log(logs);
            const {_from, _to, _amount} = logs.args;
            amount = _amount;
          });
        }
        fromBlock = currentBlock;
        i++;
      }

      // save data in db
      // add

      if (amount)
        callback({
          text: `got your bribe \nfrom- ${content.userAddress} \nchain - polygon \n for- yeetard`,
          content: {address: "0xF102DCb813DBE6D66a7101FA57D2530632ab9C9C"},
        });

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
      {
        user: "{{agent}}",
        content: {
          text: "Received bribe\nfrom- 0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1 \nchain - berachainBartio \n for- bakeland",
        },
      },
    ],
    [
      {
        user: "{{user2}}",
        content: {
          text: "take my bribe for yeetard pool on polygon from 0x1502e497B95e7B01D16C9C4C8193E6C2636f98C2",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "Send you $BUDS to \n0xF102DCb813DBE6D66a7101FA57D2530632ab9C9C, \ntime limit - 5 mins \nfrom- 0x1502e497B95e7B01D16C9C4C8193E6C2636f98C2 \nchain - polygon \n for- yeetard",
          action: "ACCEPT_BRIBE",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "got your bribe\nfrom- 0x1502e497B95e7B01D16C9C4C8193E6C2636f98C2 \nchain - polygon \n for- yeetard",
        },
      },
    ],
    [
      {
        user: "{{user3}}",
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
      {
        user: "{{agent}}",
        content: {
          text: "got your bribe\nfrom- 0x1502e497B95e7B01D16C9C4C8193E6C2636f98C2 \nchain - monad \n for- deadpool",
        },
      },
    ],
  ] as ActionExample[][],
};
