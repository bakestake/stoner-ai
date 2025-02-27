import {Address, Chain, createPublicClient, createWalletClient, getContract, http, publicActions, WalletClient} from "viem";
import {budsAbi} from "../../../artifacts/budsAbi";
import {privateKeyToAccount} from "viem/accounts";

export const burnBuds = async (amount: bigint, chain: Chain) => {
  const privateKey: `0x${string}` = process.env.WALLET_PRIVATE_KEY as Address;
  if (privateKey == null) throw new Error("Account not loaded");

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: chain,
    transport: http(),
  });

  const walletClient = createWalletClient({
    chain: chain,
    transport: http(),
  });

  if (walletClient == null) throw new Error("Client creation failed");

  const {request} = await publicClient.simulateContract({
    account,
    address: process.env.BUDS_ADDRESS as Address,
    abi: budsAbi,
    functionName: "transfer",
    args: ["0x000000000000000000000000000000000000dEaD", amount],
  });

  const hash = await walletClient.writeContract(request);
};
