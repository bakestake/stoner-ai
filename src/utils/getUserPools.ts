
import axios from "axios"

export const getUserPools = async (userAddress:string) => {
    let listOfPoolByChain: any;

    await axios
    .get(`${process.env.READ_API_URL}/pools/${userAddress}`, {
        headers: {
        "API-KEY": process.env.READ_API_KEY,
        },
    })
    .then((res) => {
        listOfPoolByChain = res.data;
    });

    return listOfPoolByChain;
}

