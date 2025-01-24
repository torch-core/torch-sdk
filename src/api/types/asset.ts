import { z } from 'zod';
import { Asset, AssetSchema } from '@torch-finance/core';
export const AssetResponseSchema = z.object({
  asset: AssetSchema.transform((asset) => new Asset(asset)),
  decimals: z.number().nullish().default(9),
});

export type AssetRawResponse = z.input<typeof AssetResponseSchema>;
export type AssetResponse = z.infer<typeof AssetResponseSchema>;
