import { z } from 'zod';
import { Asset } from '@torch-finance/core';

export const AssetResponseSchema = z
  .object({
    type: z.number(),
    jettonMaster: z.string().nullish(),
    currencyId: z.number().nullish(),
    decimals: z.number().nullish(),
  })
  .transform((asset) => {
    return {
      asset: new Asset(asset),
      decimals: asset.decimals,
    };
  });

export type AssetRawResponse = z.input<typeof AssetResponseSchema>;
export type AssetResponse = z.infer<typeof AssetResponseSchema>;
