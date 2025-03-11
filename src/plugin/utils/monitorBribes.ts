import { IAgentRuntime } from "@elizaos/core";
import  BribeAdapter  from "../../adapter/bribeAdapter.ts";
import { bribeFromMemPool } from "../../adapter/bribeAdapter.ts";
import { ethers } from "ethers";
import { getRpc } from "./getRpc.ts";

export const monitorBribes = async(runtime: IAgentRuntime, chain: string, epoch: number) => {
    // gets invoked every minute from driver function
    const ts = Date.now();
    const adapter = new BribeAdapter();

    // Fetch bribes from mem pool by chain name
    const bribesInMemPool: bribeFromMemPool[] = await adapter.retrieveBribesFromMemPool(runtime, chain);
    if (bribesInMemPool.length === 0) return;

    const provider = new ethers.JsonRpcProvider(await getRpc(chain));
    const tokenAddress = process.env.BUDS_ADDRESS;
    const abi = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
    const tokenContract = new ethers.Contract(tokenAddress, abi, provider);

    const currentBlock = await provider.getBlockNumber();
    const filter = tokenContract.filters.Transfer(null, "0xf102dcb813dbe6d66a7101fa57d2530632ab9c9c");
    const events = await tokenContract.queryFilter(filter, currentBlock - 50, currentBlock);

    if (events.length === 0) return;

    // Create a map of bribed amounts from Transfer events
    const bribeMap = new Map<string, bigint>();
    for (const event of events) {
        const logs = tokenContract.interface.parseLog(event);
        bribeMap.set(logs.args[0], logs.args[2]); // logs.args[0]: from, logs.args[2]: value (amount)
    }

    // Process each bribe in mem pool
    await Promise.all(bribesInMemPool.map(async (bribe) => {
        const bribedAmount = bribeMap.get(bribe.address) ?? BigInt(0); // Default to 0 if not found
        const poolInfo = await adapter.getPoolByName(runtime, bribe.pool);

        // If the pool exists and a bribe amount was found, save or update it
        if (poolInfo && bribedAmount > BigInt(0)) {
            await adapter.saveOrUpdateBribe(runtime, {
                poolName: bribe.pool,
                pool: poolInfo.id,
                amount: bribedAmount,
                address: bribe.address,
                chain: bribe.chain,
                epoch: epoch,
            });
            await adapter.deleteBribeFromMemPool(runtime, bribe.address, bribe.chain, bribe.pool);
        }

        // TTL of 10 mins: Remove bribe from mem pool if it's too old
        if (ts - bribe.created_at >= 600 * 1000) {
            await adapter.deleteBribeFromMemPool(runtime, bribe.address, bribe.chain, bribe.pool);
        }
    }));
};
