

export const getRpc = async (chain:string) => {
    switch (chain) {
        case "berachain":
            return process.env.ETHEREUM_PROVIDER_BERACHAIN;
        case "arbitrum":
            return process.env.ETHEREUM_PROVIDER_ARBITRUM;
        case "base":
            return process.env.ETHEREUM_PROVIDER_BASE;
        case "abstract":
            return process.env.ETHEREUM_PROVIDER_ABSTRACT;
    
        default:
            throw new Error("No rpc configured for given chain")
            break;
    }
}