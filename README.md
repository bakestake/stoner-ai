
# Bakeland AI Agent

**Bakeland AI Agent** is a social and DeFi assistant, designed to manage a wide range of functionalities for the Bakeland community, from social media engagement to on-chain reward distribution. Powered by ElizaOs, it automates various tasks while interacting seamlessly with the blockchain and the community.

## Tech Stack

- **ElizaOs**: Agent framework for conversational AI.
- **Postgres**: Database for storing pool and bribe data.
- **Thirdweb Nebula**: On-chain data aggregation for Bakeland.
- **Deepseek**: LLM (Large Language Model) provider for intelligent responses.
- **ethers.js**: Facilitates blockchain interactions.

## Key Features

1. **Social Media Posting**: The AI agent engages with users and posts updates on x.com (formerly Twitter), boosting community engagement and visibility.
   
2. **Bribe Handling**: The agent accepts bribes from users against specific pools and tracks the data across different chains.

3. **Reward Distribution**: Distributes rewards back to users based on their contributions to the Bakeland ecosystem, incentivizing active participation.

4. **Buyback and Burn**: Executes buyback or burn operations of Bakeland tokens ($BUDS), depending on metrics from the previous epoch, ensuring healthy tokenomics.

5. **Community Management**: Oversees key community operations, providing users with a dynamic, well-governed experience.

6. **Customizable Expansion**: Open to additional integrations and features that serve the evolving needs of Bakeland’s community and DeFi operations.

## Supported Actions

### 1. `RegisterPool`
This action allows users to register a new pool. The new pool gets whitelisted on the Bakeland proxy contract, making it eligible for bribes. Users can invoke this action to add a new pool and begin bribing for it.

- **Example Use Cases**:  
  - "Add a new pool for bribing"  
  - "Register a new pool for bribing"  
  - "Where's the new pool? I want to bribe for that one!"

### 2. `DeletePool`
This action removes a pool from the list of available pools. The blacklisted pool is removed from the Bakeland proxy contract, and no further bribes can be submitted to it.

- **Example Use Cases**:  
  - "Remove blacklisted pools"  
  - "Get rid of blacklisted pools"

### 3. `AcceptBribe`
When users send bribes, this action records the bribe, associating it with the specified pool and user address. It manages the bribe information across chains.

- **Example Use Cases**:  
  - "Accept bribe for {pool_name} from {user_address} on {chain}"  
  - "{Address} is sending a bribe for {pool} on {chain}"

### 4. `finalizeRound`
This action is triggered either automatically at the first bribe of a new epoch or manually by anyone. It finalizes the previous epoch’s data and makes a decision on whether to execute a buyback or burn operation.

- **Outcome**:  
  - Buys Yeet tokens at 1.25x the total bribes for the most bribed pool, or  
  - Burns 50% of the $BUDS bribed for the most bribed pool.

### 5. `claimBuyback`
This action enables users to claim Yeet tokens if a buyback occurred in the previous epoch. The reward is proportional to the user's contribution to the total bribes in the most bribed pool.

- **Example Calculation**:  
  - If a user bribed 100 $BUDS and the total bribed amount for the pool was 10,000 $BUDS, the user would receive 1% of the total Yeet tokens bought in the buyback.

## Bribe and Buyback Mechanism

Users bribe $BUDS tokens to protect their preferred pools against raids. The pool that receives the highest bribe wins the chance to either execute a Yeet token buyback or burn $BUDS, depending on last epoch’s metrics. 

- **Buyback**: If the agent determines that metrics support a buyback, it purchases Yeet tokens. Users who bribed for the winning pool can then claim these tokens based on their contribution.
  
- **Burn**: If a buyback is not suitable, 50% of the $BUDS bribed for the most bribed pool is burned, reducing token supply and enhancing its deflationary effects.

## Automation and Governance

The Bakeland AI Agent automates critical DeFi governance operations, ensuring that the community remains active and well-governed. All actions are transparent, with bribe records and pool metrics fully accessible, creating a trustless ecosystem for players and stakeholders.

---
