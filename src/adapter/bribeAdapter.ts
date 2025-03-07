import {IAgentRuntime} from "@elizaos/core";
import { Pool } from "pg";

class BribeAdapter {

  // Initialize database tables
  async initialize(runtime: IAgentRuntime): Promise<void> {

    const db : Pool = runtime.databaseAdapter.db;

    try {
      // Create pools table
      await db.query(`
        CREATE TABLE IF NOT EXISTS pools (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          chain TEXT NOT NULL,
          pooled_bribes BIGINT DEFAULT 0
        )
      `);

      // Create bribes table
      await db.query(`
        CREATE TABLE IF NOT EXISTS bribes (
          address TEXT NOT NULL,
          chain TEXT NOT NULL,
          pool INTEGER NOT NULL,
          pool_name TEXT NOT NULL,
          amount BIGINT NOT NULL,
          epoch INTEGER NOT NULL,
          PRIMARY KEY (address, pool, chain, epoch),
          FOREIGN KEY (pool) REFERENCES pools(id)
        )
      `);

      // Create epoch_decision table
      await db.query(`
        CREATE TABLE IF NOT EXISTS epoch_decision (
          epoch INTEGER PRIMARY KEY,
          dec INTEGER NOT NULL CHECK (dec IN (0, 1)),
          amount BIGINT NOT NULL
        )
      `);

      await db.query(
        `
        CREATE TABLE bribe_pool (
          id SERIAL PRIMARY KEY,
          user_address VARCHAR(255) NOT NULL,
          amount DECIMAL(18, 8) NOT NULL,
          chain VARCHAR(50) NOT NULL,
          pool VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        `
      );

    } catch (err) {
      console.error("Error initializing database tables:", err);
      throw new Error(`Failed to initialize database tables: ${err.message}`);
    }
  }

  // Helper function to map a database row to a poolInfo object
  private mapRowToPoolInfo(row: any): poolInfo {
    return {
      id: row.id,
      name: row.name,
      chain: row.chain,
      pooledBribes: BigInt(row.pooled_bribes || 0),
    };
  }

  // Helper function to map a database row to a bribes object
  private mapRowToBribe(row: any): bribes {
    return {
      address: row.address,
      chain: row.chain,
      pool: row.pool,
      poolName: row.pool_name,
      amount: BigInt(row.amount || 0),
      epoch: row.epoch, // Include the epoch field
    };
  }

  private mapRowToEpochDecision(row: any): epochDecision {
    return {
      epoch: row.epoch,
      dec: row.dec,
      amount: BigInt(row.amount || 0),
      pool: row.pool,
    };
  }

  // Function to insert a new epoch decision (once set, it cannot be updated)
  async insertEpochDecision(runtime: IAgentRuntime, decision: epochDecision): Promise<void> {
    const db = runtime.databaseAdapter.db;

    // Validate input data
    if (!decision.epoch || decision.epoch <= 0) {
      throw new Error("Invalid epoch value");
    }
    if (decision.dec !== 0 && decision.dec !== 1) {
      throw new Error("Invalid decision value, must be 0 (burn) or 1 (yeet buyback)");
    }
    if (decision.amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    try {
      await db.query("BEGIN"); // Start transaction

      // Check if the epoch decision already exists (making it immutable)
      const existingDecision = await this.getEpochDecision(runtime, decision.epoch);
      if (existingDecision) {
        throw new Error(`Epoch decision for epoch ${decision.epoch} already exists and cannot be modified.`);
      }

      // Insert new epoch decision
      const query = `
        INSERT INTO epoch_decision (epoch, dec, amount, pool)
        VALUES ($1, $2, $3, $4)
      `;
      const values = [decision.epoch, decision.dec, decision.amount, decision.pool];

      await db.query(query, values);
      await db.query("COMMIT"); // Commit transaction
    } catch (err) {
      await db.query("ROLLBACK"); // Rollback on error
      console.error(`Error inserting epoch decision for epoch ${decision.epoch}:`, err);
      throw new Error(`Failed to insert epoch decision for epoch ${decision.epoch}: ${err.message}`);
    }
  }

  // Function to retrieve epoch decision by epoch
  async getEpochDecision(runtime: IAgentRuntime, epoch: number): Promise<epochDecision | null> {
    const db = runtime.databaseAdapter.db;

    const query = `
      SELECT epoch, dec, amount, pool
      FROM epoch_decision
      WHERE epoch = $1
    `;
    try {
      const result = await db.query(query, [epoch]);
      if (result.rows.length > 0) {
        return this.mapRowToEpochDecision(result.rows[0]);
      } else {
        return null; // No decision found for the given epoch
      }
    } catch (err) {
      console.error(`Error retrieving epoch decision for epoch ${epoch}:`, err);
      throw new Error(`Failed to retrieve epoch decision for epoch ${epoch}: ${err.message}`);
    }
  }

  // Function to retrieve all epoch decisions
  async getAllEpochDecisions(runtime: IAgentRuntime): Promise<epochDecision[]> {
    const db = runtime.databaseAdapter.db;

    const query = `
      SELECT epoch, dec, amount, pool
      FROM epoch_decision
      ORDER BY epoch ASC
    `;
    try {
      const result = await db.query(query);
      return result.rows.map(this.mapRowToEpochDecision);
    } catch (err) {
      console.error("Error retrieving all epoch decisions:", err);
      throw new Error(`Failed to retrieve epoch decisions: ${err.message}`);
    }
  }

  // Function to register a new pool
  async registerPool(runtime: IAgentRuntime, poolData: poolInfo): Promise<void> {
    const db = runtime.databaseAdapter.db;

    // Validate input data
    if (!poolData.id || poolData.id <= 0) {
      throw new Error("Invalid pool ID");
    }
    if (!poolData.name || typeof poolData.name !== "string") {
      throw new Error("Invalid pool name");
    }
    if (!poolData.chain || typeof poolData.chain !== "string") {
      throw new Error("Invalid chain");
    }

    const query = `
      INSERT INTO pools (id, name, chain, pooled_bribes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `;
    const values = [poolData.id, poolData.name, poolData.chain, poolData.pooledBribes];

    try {
      await db.query(query, values);
    } catch (err) {
      console.error(`Error registering pool ${poolData.name}:`, err);
      throw new Error(`Failed to register pool ${poolData.name}: ${err.message}`);
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
      return this.mapRowToPoolInfo(result.rows[0]);
    } catch (err) {
      console.error(`Error retrieving pool by name ${poolName}:`, err);
      throw new Error(`Failed to retrieve pool by name ${poolName}: ${err.message}`);
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
      console.error(`Error checking pool registration for ${poolName}:`, err);
      throw new Error(`Failed to check pool registration for ${poolName}: ${err.message}`);
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
      return result.rows.map(this.mapRowToPoolInfo);
    } catch (err) {
      console.error("Error retrieving all pools:", err);
      throw new Error(`Failed to retrieve all pools: ${err.message}`);
    }
  }

  // Function to save or update bribe record (update if bribe exists for same user & pool)
  async saveOrUpdateBribe(runtime: IAgentRuntime, bribeData: bribes): Promise<void> {
    const db = runtime.databaseAdapter.db;

    // Validate input data
    if (!bribeData.address || typeof bribeData.address !== "string") {
      throw new Error("Invalid address");
    }
    if (!bribeData.chain || typeof bribeData.chain !== "string") {
      throw new Error("Invalid chain");
    }
    if (!bribeData.pool || bribeData.pool <= 0) {
      throw new Error("Invalid pool ID");
    }
    if (!bribeData.poolName || typeof bribeData.poolName !== "string") {
      throw new Error("Invalid pool name");
    }
    if (!bribeData.epoch || bribeData.epoch <= 0) {
      throw new Error("Invalid epoch");
    }

    try {
      await db.query("BEGIN"); // Start transaction

      // Check if the pool is registered
      const isRegistered = await this.isPoolRegistered(runtime, bribeData.poolName);
      if (!isRegistered) {
        throw new Error(`Pool with ID ${bribeData.pool} is not registered.`);
      }

      const queryExistingBribe = `
        SELECT amount FROM bribes WHERE address = $1 AND pool = $2 AND chain = $3 AND epoch = $4
      `;
      const existingBribe = await db.query(queryExistingBribe, [bribeData.address, bribeData.pool, bribeData.chain, bribeData.epoch]);

      let amount;
      if(existingBribe.rows.length > 0) {
        amount = existingBribe.rows[0].amount + bribeData.amount;
      }

      const query = `
        INSERT INTO bribes (address, chain, pool, pool_name, amount, epoch)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (address, pool, chain, epoch) 
        DO UPDATE SET amount = bribes.amount + EXCLUDED.amount
      `;
      const values = [bribeData.address, bribeData.chain, bribeData.pool, bribeData.poolName, amount, bribeData.epoch];

      await db.query(query, values);
      await db.query("COMMIT"); // Commit transaction
    } catch (err) {
      await db.query("ROLLBACK"); // Rollback on error
      console.error(`Error saving or updating bribe for address ${bribeData.address}:`, err);
      throw new Error(`Failed to save or update bribe for address ${bribeData.address}: ${err.message}`);
    }
  }

  // Function to retrieve bribes by a user address
  async getBribesByUser(runtime: IAgentRuntime, address: string): Promise<bribes[]> {
    const db = runtime.databaseAdapter.db;

    const query = `
      SELECT address, chain, pool, pool_name, amount, epoch
      FROM bribes
      WHERE address = $1
    `;
    try {
      const result = await db.query(query, [address]);
      return result.rows.map(this.mapRowToBribe);
    } catch (err) {
      console.error(`Error retrieving bribes by user ${address}:`, err);
      throw new Error(`Failed to retrieve bribes by user ${address}: ${err.message}`);
    }
  }

  // Function to retrieve bribes by pool ID
  async getBribesByPool(runtime: IAgentRuntime, poolId: number): Promise<bribes[]> {
    const db = runtime.databaseAdapter.db;

    const query = `
      SELECT address, chain, pool, pool_name, amount, epoch
      FROM bribes
      WHERE pool = $1
    `;
    try {
      const result = await db.query(query, [poolId]);
      return result.rows.map(this.mapRowToBribe);
    } catch (err) {
      console.error(`Error retrieving bribes by pool ${poolId}:`, err);
      throw new Error(`Failed to retrieve bribes by pool ${poolId}: ${err.message}`);
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
      return BigInt(result.rows[0].totalbribes);
    } catch (err) {
      console.error(`Error retrieving total bribes for pool ${poolId}:`, err);
      throw new Error(`Failed to retrieve total bribes for pool ${poolId}: ${err.message}`);
    }
  }

  async getMostBribedPool(runtime: IAgentRuntime): Promise<poolInfo | null> {
    const db = runtime.databaseAdapter.db;

    const query = `
      SELECT p.id, p.name, p.chain, p.pooled_bribes
      FROM pools p
      INNER JOIN (
        SELECT pool, SUM(amount) AS total_bribes
        FROM bribes
        GROUP BY pool
      ) b ON p.id = b.pool
      ORDER BY b.total_bribes DESC
      LIMIT 1
    `;

    try {
      const result = await db.query(query);
      if (result.rows.length === 0) {
        return null; // No pools found
      }
      return this.mapRowToPoolInfo(result.rows[0]);
    } catch (err) {
      console.error("Error retrieving the most bribed pool:", err);
      throw new Error(`Failed to retrieve the most bribed pool: ${err.message}`);
    }
  }

  // Function to delete a pool
  async deletePool(runtime: IAgentRuntime, poolId: number): Promise<boolean> {
    const db = runtime.databaseAdapter.db;

    const query = `DELETE FROM pools WHERE id = $1`;
    try {
      await db.query(query, [poolId]);
      return true;
    } catch (err) {
      console.error(`Error deleting pool ${poolId}:`, err);
      throw new Error(`Failed to delete pool ${poolId}: ${err.message}`);
    }
  }

  // Function to delete a bribe
  async deleteBribe(runtime: IAgentRuntime, address: string, poolId: number, chain: string, epoch: number): Promise<void> {
    const db = runtime.databaseAdapter.db;

    const query = `
      DELETE FROM bribes
      WHERE address = $1 AND pool = $2 AND chain = $3 AND epoch = $4
    `;
    try {
      await db.query(query, [address, poolId, chain, epoch]);
    } catch (err) {
      console.error(`Error deleting bribe for address ${address}, pool ${poolId}, chain ${chain}, epoch ${epoch}:`, err);
      throw new Error(`Failed to delete bribe for address ${address}, pool ${poolId}, chain ${chain}, epoch ${epoch}: ${err.message}`);
    }
  }

  async saveBribeToPool(runtime: IAgentRuntime, userAddress, amount, chain, pool) {
    const db = runtime.databaseAdapter.db;

    const query = `
        INSERT INTO bribe_pool (user_address, amount, chain, pool)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    `;

    const values = [userAddress, amount, chain, pool];

    try {
        const res = await db.query(query, values);
        return res.rows[0]; // returns the saved bribe
    } catch (err) {
        console.error('Error saving bribe to pool:', err);
        throw err;
    }
  }

  async deleteBribeFromPool(runtime: IAgentRuntime, userAddress, chain, pool) {
    const db = runtime.databaseAdapter.db;

    const query = `
        DELETE FROM bribe_pool 
        WHERE user_address = $1 AND chain = $2 AND pool = $3
        RETURNING *;
    `;
    const values = [userAddress, chain, pool];
    try {
        const res = await db.query(query, values);
        return res.rows[0]; // returns the deleted bribe if successful
    } catch (err) {
        console.error('Error deleting bribe from pool:', err);
        throw err;
    }
  }


}

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
  epoch: number;
}

export interface epochDecision {
  epoch: number;
  dec: number; // 0 or 1.. 0 for burn, 1 for yeet buyback
  amount: bigint; // amount to burned or yeet buyback
  pool: number;
}

export default BribeAdapter;