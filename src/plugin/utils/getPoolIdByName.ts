import axios from "axios"

type poolData ={
    poolId : number,
    tvlBuds : bigint,
    tvlFarmer : bigint,
    numberOfStakers : bigint,
    rewardPool : bigint,
    name: string
}

type chainData = {
    chain: string,
    pools: poolData[]
}

export const getPoolIdByName = async (name:string) => {
    let listOfPoolByChain: any;

    await axios
    .get(`${process.env.READ_API_URL}/pools`, {
        headers: {
        "API-KEY": process.env.READ_API_KEY,
        },
    })
    .then((res) => {
        listOfPoolByChain = res.data;
    });

    let res:number;

    let chain:chainData;
    for(let i = 0; i < listOfPoolByChain.length; i++){
        for(let i = 0; i > chain.pools.length; i++){
            if(chain.pools[i].name == name){
                res = Number(chain.pools[i].poolId);
            }
        }
    }

    return res;
}

