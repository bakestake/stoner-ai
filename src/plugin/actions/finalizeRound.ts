import {Action, elizaLogger, IAgentRuntime, Memory, State, HandlerCallback, ActionExample} from "@elizaos/core";
import {ethers} from "ethers";
import {poolInfo} from "../../adapter/bribeAdapter";
import BribeAdapter from "../../adapter/bribeAdapter";
import {burnBuds} from "../utils/burnBuds";
import {berachainTestnetbArtio} from "viem/chains";
import buyYeet from "../utils/buyYeet";
import {diamondAbi} from "../../../artifacts/diamondAbi";
import {bigint} from "zod";

export const finalizeRound: Action = {
  name: "FINALIZE_ROUND",
  similes: ["EPOCH_CHANGE", "ROUND_FINALIZATION", "INSURANCE_DECISION"],
  description: "Finalizes the round on epoch change by deciding to burn $BUDS or buy $YEET tokens based on raid data.",
  suppressInitialMessage: true,
  validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    // Ensure required settings are configured
    return !!(runtime.getSetting("WALLET_PRIVATE_KEY") && runtime.getSetting("DIAMOND_ADDRESS") && runtime.getSetting("ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO"));
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, _options: Record<string, unknown>, callback?: HandlerCallback): Promise<boolean> => {
    try {
      elizaLogger.info("Entered FINALIZE_ROUND action", {state, message});

      // Record epoch-wise data in the database
      const adapter = new BribeAdapter();

      // Initialize Ethereum provider and Bakeland contract
      const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_BERACHAINTESTNETBARTIO);
      const bakelandContract = new ethers.Contract(process.env.DIAMOND_ADDRESS, diamondAbi, provider);

      // Get the current epoch from the event
      const epoch = await bakelandContract.getCurrentEpoch(); // Replace with actual function to get current epoch
      elizaLogger.info("Epoch changed detected", {epoch});

      // Get the most bribed
      const mostBribedPool: poolInfo = await adapter.getMostBribedPool(runtime);
      elizaLogger.info(`most bribed pool is ${mostBribedPool.chain} and amount is ${mostBribedPool.pooledBribes}`);

      // Get raid data for the most bribed pool
      const totalLost = await bakelandContract.getBudsLostToRaids(mostBribedPool.id);
      const poolData = await bakelandContract.getPoolData(mostBribedPool.id);
      elizaLogger.info("Raid data for pool", {totalLost});

      // Decision logic
      const raidLossPercentage = (totalLost / poolData.stakedBudsVolume) * 100;
      let decision: "burn" | "buyYeet";
      let decisionReason: string;

      if (raidLossPercentage < 5) {
        // If raid loss is less than 5% of total staked, burn $BUDS
        decision = "burn";
        decisionReason = `Raid loss is negligible compared to total staked $BUDS to be insured.`;
      } else {
        // If raid loss is significant, buy $YEET tokens to compensate
        decision = "buyYeet";
        decisionReason = `Raid loss is significant. Compensating with $YEET tokens. claim if you bribed me for ${mostBribedPool.name}`;
      }

      elizaLogger.info("Decision made", {decision, decisionReason});

      // Execute decision using existing functions
      if (decision === "burn") {
        await adapter.insertEpochDecision(runtime, {amount: totalLost, epoch: epoch, dec: 0, pool: mostBribedPool.id});
        await burnBuds(totalLost, berachainTestnetbArtio);
      } else {
        const amoutToBuyback = BigInt(1.25) * mostBribedPool.pooledBribes;
        const buyedYeetAmount = await buyYeet(amoutToBuyback);
        await adapter.insertEpochDecision(runtime, {amount: buyedYeetAmount, epoch: epoch, dec: 1, pool: mostBribedPool.id});
      }

      // Notify user of decision
      if (callback) {
        callback({
          text: `Round finalized for epoch ${epoch}. Decision: ${decision}. Reason: ${decisionReason}`,
        });
      }

      return true;
    } catch (error) {
      elizaLogger.error("Error finalizing round:", {
        message: error.message,
        code: error.code,
      });
      if (callback) {
        callback({
          text: `Error finalizing round: ${error.message}`,
        });
      }
      return false;
    }
  },
  examples: [
    // Example conversations (optional)
  ] as ActionExample[][],
} as Action;

export default finalizeRound;
