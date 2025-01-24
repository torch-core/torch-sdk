import { z } from 'zod';
import { AddressSchema } from '@torch-finance/core';
import { AssetResponseSchema } from './asset';

export const BasePoolSchema = z.object({
  type: z.union([z.literal('Base'), z.literal('Meta')]),
  address: AddressSchema,
  lpAsset: AssetResponseSchema,
  assets: z.array(AssetResponseSchema),
  useRates: z.boolean(),
});

export const PoolResponseSchema = BasePoolSchema.extend({
  basePool: BasePoolSchema.nullish(),
}).refine((data) => (data.type === 'Meta' ? data.basePool !== undefined : true), {
  message: 'basePool is required for meta pool',
  path: ['basePool'],
});

export type PoolResponse = z.infer<typeof PoolResponseSchema>;
export type PoolRawResponse = z.input<typeof PoolResponseSchema>;
