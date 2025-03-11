export const getDestEid = async (chain) => {
    switch (chain) {
        case "berachain":
            return "30362";
        case "arbitrum":
            return "30110";
        case "base":
            return "30184";
        case "avax":
            return "30106";
        case "abstract":
            return "30324";
        case "arbSepolia":
            return "40231";
        case "fuji":
            return "40106";
        case "abstractTestnet":
            return "40313";
        default:
            throw new Error("No EID configured for given chain")
            break;
    }
}