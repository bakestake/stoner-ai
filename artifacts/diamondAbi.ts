export const diamondAbi = [
  {
    inputs: [],
    name: "getNumberOfPools",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "poolId",
        type: "uint256",
      },
    ],
    name: "getPoolData",
    outputs: [
      {
        internalType: "uint256",
        name: "stakedBudsVolume",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "noOfStakers",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "currentPooledRewards",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];
