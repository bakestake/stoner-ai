import {z} from "zod";

export const initiateBribeParamSchema = z.object({
  userAddress: z.string().min(1).toUpperCase(),
  poolName: z.string().min(1).toLowerCase(),
  chain: z.string().min(1),
});
