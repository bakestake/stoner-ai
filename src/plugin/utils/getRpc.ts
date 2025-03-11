

export const getRpc = async (chain:string) => {
    switch (chain) {
        case "berachain":
            return process.env.ETHEREUM_PROVIDER_BERACHAIN;
        case "arbitrum":
            return process.env.ETHEREUM_PROVIDER_ARBITRUM;
        case "base":
            return process.env.ETHEREUM_PROVIDER_BASE;
        case "avax":
            return process.env.ETHEREUM_PROVIDER_AVAX;
        case "abstract":
            return process.env.ETHEREUM_PROVIDER_ABSTRACT;
        case "arbSepolia":
            return process.env.ARB_SEPOLIA;
        case "fuji":
            return process.env.FUJI;
        default:
            throw new Error("No rpc configured for given chain")
            break;
    }
}