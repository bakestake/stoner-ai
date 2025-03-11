import { ethers } from "ethers";
import { diamondAbi } from "../../../artifacts/diamondAbi.ts";
import { getRpc } from "./getRpc.ts";
import { budsAbi } from "../../../artifacts/budsAbi.ts";
import { error } from "console";
import { getDestEid } from "./getDestEid.ts";

/// chain name should be of eligible ones from getChains, amount should be readily parsed and address can be in any format [addressLike or string]
export const cctBuds = async(from:string, to:string, amount:bigint, address:string) => {

    try{
        const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, new ethers.JsonRpcProvider(await getRpc(from)))
        const contractInst = new ethers.Contract(process.env.DIAMOND_ADDRESS, diamondAbi, wallet);
        const budsInst = new ethers.Contract(process.env.BUDS_ADDRESS, budsAbi, wallet)
        const budsBal = await budsInst.balanceOf(process.env.WALLET_PUBLIC_KEY);
        
        if(amount > Number(budsBal)){
            throw new error("Insufficient balance")
        }

        const destEid = await getDestEid(to)

        console.log("sending across buds to ", to)

        const fee = await contractInst.getCctxFees(destEid, amount, 0, address, ethers.encodeBytes32String("CROSS_CHAIN_BUDS_TRANSFER"));

        await contractInst.crossChainBudsTransfer(destEid, address, amount,{value: fee})

        console.log(`Successfully sent buds to ${address} from ${from} to ${to}`)
    }catch(error){
        console.log(`failed to sent buds across chain dur to error - ${error}`)
        throw new Error(error)
    }
}