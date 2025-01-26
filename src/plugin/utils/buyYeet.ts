import {
	http,
	type Address,
	createWalletClient,
	maxUint256,
	parseEther,
	publicActions,
	zeroAddress,
    ByteArray,
    ChainDisconnectedError,
} from "viem"; // Main library used to interface with the blockchain
import { privateKeyToAccount } from "viem/accounts";
import { berachainTestnetbArtio } from "viem/chains";

if (!process.env.WALLET_PRIVATE_KEY) throw new Error("PRIVATE_KEY is required");
if (!process.env.PUBLIC_API_URL) throw new Error("PUBLIC_API_URL is required");
if (!process.env.API_KEY) throw new Error("API_KEY is required");

const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY as Address; // Private key of the account to make the trade
const PUBLIC_API_URL = process.env.OOGA_BOOGA_API_URL;
const API_KEY = process.env.OOGA_BOOGA_API_KEY;

type SwapParams = {
    tokenIn: Address, // Address of the token swapping from (HONEY)
    tokenOut: Address, // Address of the token swapping to (BERA)
    amount: bigint, // Amount of tokenIn to swap
    to: Address, // Address to send tokenOut to (optional and defaults to `from`)
    slippage: number, // Range from 0 to 1 to allow for price slippage
}

const account = privateKeyToAccount(PRIVATE_KEY);
const client = createWalletClient({
	chain: berachainTestnetbArtio,
	transport: http(),
	account,
}).extend(publicActions);

// Bartio token addresses
const BUDS: Address = process.env.BUDS_ADDRESS as Address; // Default address for Bera native token
const YEET: Address = process.env.YEET_TOKEN_ADDRESS as Address // 



const headers = {
	Authorization: `Bearer ${API_KEY}`,
};

const getAllowance = async (token: Address, from: Address) => {
  // Native token does not require approvals for allowance
	if (token === BUDS) return maxUint256;

	const publicApiUrl = new URL(`${PUBLIC_API_URL}/v1/approve/allowance`);
	publicApiUrl.searchParams.set("token", token);
	publicApiUrl.searchParams.set("from", from);

	const res = await fetch(publicApiUrl, {
		headers,
	});
	const json = await res.json();
	return json.allowance;
};

const approveAllowance = async (
	token: Address,
	amount: bigint,
) => {
	const publicApiUrl = new URL(`${PUBLIC_API_URL}/v1/approve`);
	publicApiUrl.searchParams.set("token", token);
	publicApiUrl.searchParams.set("amount", amount.toString());

	const res = await fetch(publicApiUrl, { headers });
	const { tx } = await res.json();

	console.log("Submitting approve...");
	const hash = await client.sendTransaction({
        from: tx.from as Address,
        to: tx.to as Address,
        data: tx.data as `0x${string}`,
        kzg: {
            blobToKzgCommitment: function (blob: ByteArray): ByteArray {
                throw new Error("Function not implemented.");
            },
            computeBlobKzgProof: function (blob: ByteArray, commitment: ByteArray): ByteArray {
                throw new Error("Function not implemented.");
            }
        },
        account: account.address,
        chain: undefined
    });

	const rcpt = await client.waitForTransactionReceipt({
		hash,
	});
	console.log("Approval complete", rcpt.transactionHash, rcpt.status);
};

const swap = async (swapParams: SwapParams) => {
	const publicApiUrl = new URL(`${PUBLIC_API_URL}/v1/swap`);
	publicApiUrl.searchParams.set("tokenIn", swapParams.tokenIn);
	publicApiUrl.searchParams.set("amount", swapParams.amount.toString());
	publicApiUrl.searchParams.set("tokenOut", swapParams.tokenOut);
	publicApiUrl.searchParams.set("to", swapParams.to);
	publicApiUrl.searchParams.set("slippage", swapParams.slippage.toString());

	const res = await fetch(publicApiUrl, { headers });
	const { tx } = await res.json();

	console.log("Submitting swap...");
	const hash = await client.sendTransaction({
        to: tx.to as Address,
        data: tx.data as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : 0n,
        kzg: {
            blobToKzgCommitment: function (blob: ByteArray): ByteArray {
                throw new Error("Function not implemented.");
            },
            computeBlobKzgProof: function (blob: ByteArray, commitment: ByteArray): ByteArray {
                throw new Error("Function not implemented.");
            }
        },
        account: account.address,
        chain: undefined
    });
	console.log("hash", hash);

	const rcpt = await client.waitForTransactionReceipt({
		hash,
	});
	console.log("Swap complete", rcpt.status);
};

async function buyYeet(amount: bigint) {
    
    const swapParams = {
        tokenIn: BUDS, // Address of the token swapping from (HONEY)
        tokenOut: YEET, // Address of the token swapping to (BERA)
        amount: parseEther(amount.toString()), // Amount of tokenIn to swap
        to: account.address, // Address to send tokenOut to (optional and defaults to `from`)
        slippage: 0.01, // Range from 0 to 1 to allow for price slippage
    };
	// Check allowance
	const allowance = await getAllowance(swapParams.tokenIn, account.address);
	console.log("Allowance", allowance);

	// Approve if necessary
	if (allowance < swapParams.amount) {
		await approveAllowance(
			swapParams.tokenIn,
			swapParams.amount - allowance, // Only approve amount remaining
		);
	}
	// Swap
	await swap(swapParams);
}

export default buyYeet;