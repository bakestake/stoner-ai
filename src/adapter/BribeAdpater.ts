import {IAgentRuntime} from "@elizaos/core";
import {Pool} from "pg";

export interface poolInfo {
  id: number;
  name: string;
  chain: string;
  pooledBribes: bigint;
}

export interface user {
  address: string;
  bribes: bigint;
}

export interface bribes {
  address: string;
  chain: string;
  pool: number;
  poolName: string;
  amount: bigint;
}

export class BribeAdpater {
  // Function to register a new pool
  async registerPool(runtime: IAgentRuntime, poolData: poolInfo): Promise<void> {
    const db = runtime.databaseAdapter.db;

    const query = `
      INSERT INTO pools (id, name, chain, pooled_bribes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `;
    const values = [poolData.id, poolData.name, poolData.chain, poolData.pooledBribes];

    try {
      await db.query(query, values);
    } catch (err) {
      console.error("Error registering pool:", err);
      throw err;
    }
  }

  // Function to retrieve pool data by pool name
  async getPoolByName(runtime: IAgentRuntime, poolName: string): Promise<poolInfo | null> {
    const db = runtime.databaseAdapter.db;
    const query = `
    SELECT id, name, chain, pooled_bribes
    FROM pools
    WHERE name = $1
  `;
    try {
      const result = await db.query(query, [poolName]);
      if (result.rows.length === 0) {
        return null; // Pool not found
      }
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        chain: row.chain,
        pooledBribes: BigInt(row.pooled_bribes),
      };
    } catch (err) {
      console.error("Error retrieving pool by name:", err);
      throw err;
    }
  }

  // Function to check if a pool is registered
  async isPoolRegistered(runtime: IAgentRuntime, poolName: string): Promise<boolean> {
    const db = runtime.databaseAdapter.db;

    const query = `SELECT id FROM pools WHERE name = $1`;
    try {
      const result = await db.query(query, [poolName]);
      return result.rows.length > 0;
    } catch (err) {
      console.error("Error checking pool registration:", err);
      throw err;
    }
  }

  // Function to retrieve all pools
  async getAllPools(runtime: IAgentRuntime): Promise<poolInfo[]> {
    const db = runtime.databaseAdapter.db;
    const query = `
    SELECT id, name, chain, pooled_bribes
    FROM pools
  `;
    try {
      const result = await db.query(query);
      return result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        chain: row.chain,
        pooledBribes: BigInt(row.pooled_bribes),
      }));
    } catch (err) {
      console.error("Error retrieving all pools:", err);
      throw err;
    }
  }

  // Function to save or update bribe record (update if bribe exists for same user & pool)
  async saveOrUpdateBribe(runtime: IAgentRuntime, bribeData: bribes): Promise<void> {
    const db = runtime.databaseAdapter.db;

    // Check if the pool is registered
    const isRegistered = await this.isPoolRegistered(runtime, bribeData.poolName);
    if (!isRegistered) {
      throw new Error(`Pool with ID ${bribeData.pool} is not registered.`);
    }

    const query = `
      INSERT INTO bribes (address, chain, pool, pool_name, amount)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (address, pool, chain) 
      DO UPDATE SET amount = EXCLUDED.amount
    `;
    const values = [bribeData.address, bribeData.chain, bribeData.pool, bribeData.poolName, bribeData.amount];

    try {
      await db.query(query, values);
    } catch (err) {
      console.error("Error saving or updating bribe:", err);
      throw err;
    }
  }

  // Function to retrieve bribes by a user address
  async getBribesByUser(runtime: IAgentRuntime, address: string): Promise<bribes[]> {
    const db = runtime.databaseAdapter.db;

    const query = `
      SELECT address, chain, pool, pool_name, amount
      FROM bribes
      WHERE address = $1
    `;
    try {
      const result = await db.query(query, [address]);
      return result.rows.map((row: any) => ({
        address: row.address,
        chain: row.chain,
        pool: row.pool,
        poolName: row.pool_name,
        amount: row.amount,
      }));
    } catch (err) {
      console.error("Error retrieving bribes by user:", err);
      throw err;
    }
  }

  // Function to retrieve bribes by pool ID
  async getBribesByPool(runtime: IAgentRuntime, poolId: number): Promise<bribes[]> {
    const db = runtime.databaseAdapter.db;

    const query = `
      SELECT address, chain, pool, pool_name, amount
      FROM bribes
      WHERE pool = $1
    `;
    try {
      const result = await db.query(query, [poolId]);
      return result.rows.map((row: any) => ({
        address: row.address,
        chain: row.chain,
        pool: row.pool,
        poolName: row.pool_name,
        amount: row.amount,
      }));
    } catch (err) {
      console.error("Error retrieving bribes by pool:", err);
      throw err;
    }
  }

  // Function to retrieve total pooled bribes for a pool
  async getTotalBribesForPool(runtime: IAgentRuntime, poolId: number): Promise<bigint> {
    const db = runtime.databaseAdapter.db;

    const query = `
      SELECT COALESCE(SUM(amount), 0) AS totalBribes
      FROM bribes
      WHERE pool = $1
    `;
    try {
      const result = await db.query(query, [poolId]);
      return BigInt(result.rows[0].totalBribes);
    } catch (err) {
      console.error("Error retrieving total bribes for pool:", err);
      throw err;
    }
  }
}
