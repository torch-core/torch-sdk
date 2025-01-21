import { z } from 'zod';
import { Asset, AssetSchema } from '@torch-finance/core';
export const AssetResponseSchema = z.object({
  asset: AssetSchema.transform((asset) => new Asset(asset)),
  name: z.string().nullish(),
  symbol: z.string().nullish(),
  decimals: z.number().nullish().default(9),
  image: z.string().nullish(),
  description: z.string().nullish(),
});

export type AssetRawResponse = z.input<typeof AssetResponseSchema>;
export type AssetResponse = z.infer<typeof AssetResponseSchema>;
