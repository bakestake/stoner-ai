import { Action, composeContext, elizaLogger, generateObjectDeprecated, HandlerCallback, IAgentRuntime, Memory, ModelClass, State } from "@elizaos/core";
import { z } from "zod";
import BribeAdapter, { epochDecision } from "../../adapter/bribeAdapter.ts";
import { ethers } from "ethers";
import { budsAbi } from "../../../artifacts/budsAbi.ts";
import { diamondAbi } from "../../../artifacts/diamondAbi.ts";


const claimBuyBackMsgSchema = z.object({
    userAddress: z.string().toLowerCase().min(1),
    epoch: z.number().min(1),
  });
  
const claimBuyBackMsgTemplate = `Look at user's FIRST MESSAGE in the conversation where user sent message to claim buyback.
  Based on ONLY that first message, extract the details:
  
  Details must include userAddress, and epoch. For example:
  - For "Claim buyback for userAddress 0x1234567890123456789012345678901234567890 in epoch 1" -> "0x1234567890123456789012345678901234567890" as userAddress, and "1" as epoch
  - For "Claim yeet for userAddress 0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1 in epoch 4" -> "0x5EF0d89a9E859CFcA0C52C9A17CFF93f1A6A19C1" as userAddress, and "4" as epoch
  
  \`\`\`json
  {
      "userAddress": "<userAddress>",
      "epoch": "<epoch>"
  }
  \`\`\`
  
  Recent conversation:
  {{recentMessages}}`;


export const claimBuyBack: Action = {
    name: "CLAIM_BUYBACK",
    similes: ["CLAIM_YEET"],
    description: "Claims the YEET tokens from the buyback contract.",
    suppressInitialMessage: true,
    validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        return !!(runtime.getSetting("WALLET_PRIVATE_KEY") && runtime.getSetting("DIAMOND_ADDRESS") && runtime.getSetting("ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO"));
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State, _options: Record<string, unknown>, callback?: HandlerCallback): Promise<boolean> => {
        try {
            elizaLogger.log("ENTERED ACTION");
            const context = composeContext({
                state,
                template: claimBuyBackMsgTemplate,
            });

            let content = await generateObjectDeprecated({
                runtime,
                context: context,
                modelClass: ModelClass.SMALL,
            });

            const parseResult = claimBuyBackMsgSchema.safeParse(content);
            if (!parseResult.success) {
                throw new Error(`Invalid claim buyback message content: ${JSON.stringify(parseResult.error.errors, null, 2)}`);
            }

            const { userAddress, epoch } = content;

            const adapter = new BribeAdapter();

            const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO);

            const yeet = new ethers.Contract(process.env.YEET_ADDRESS, budsAbi, provider);
            const diamond = new ethers.Contract(process.env.DIAMOND_ADDRESS, diamondAbi, provider);
            const curEpoch = await diamond.getCurrentEpoch();

            if (epoch > curEpoch) {
                callback({
                    text: "Epoch not finished yet",
                    type: "error"
                });
                return false;
            }

            const epochDec : epochDecision = await adapter.getEpochDecision(runtime, epoch);

            if(epochDec.dec === 0) {
                callback({
                    text: "No buyback to claim",
                    type: "error"
                });
                return false;
            }

            const yeetAmount = epochDec.amount;

            const userBribes = await adapter.getBribesByPool(runtime, userAddress);
            const bribesByPool = await adapter.getBribesByPool(runtime, epochDec.pool);
            const filteredByEpoch = bribesByPool.filter(bribe => bribe.epoch === epoch);
            const totalBribes = filteredByEpoch.reduce((acc, bribe) => acc + bribe.amount, BigInt(0));

            const userBribe = userBribes.find(bribe => bribe.epoch === epoch && bribe.address === userAddress);
            
            if(!userBribe) {
                callback({
                    text: "User bribe not found",
                    type: "error"
                });
                return false;
            }

            // Calculate user's share of the total bribes
            const userShare = (userBribe.amount * yeetAmount) / totalBribes;

            if (userShare <= 0) {
                callback({
                    text: "No rewards to claim",
                    type: "error"
                });
                return false;
            }
            const tx = await yeet.transfer(userAddress, yeetAmount);
            await tx.wait();

            callback({
                text: `Claimed ${yeetAmount} $YEET from epoch ${epoch}`,
                type: "success"
            });
            return true;
            
        } catch (error) {
            elizaLogger.error("Error in CLAIM_BUYBACK action", { error });
        }
    },
    examples: []
}

