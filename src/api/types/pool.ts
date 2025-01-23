import { z } from 'zod';
import { AddressSchema } from '@torch-finance/core';
import { AssetResponseSchema } from './asset';

export enum PoolType {
  BASE = 'Base',
  META = 'Meta',
}

export const BasePoolInfoSchema = z.object({
  type: z.nativeEnum(PoolType),
  address: AddressSchema,
  lpAsset: AssetResponseSchema,
  assets: z.array(AssetResponseSchema),
  useRates: z.boolean(),
});

export const PoolResponseSchema = BasePoolInfoSchema.extend({
  basePoolInfo: BasePoolInfoSchema.optional(),
}).refine((data) => (data.type === PoolType.META ? data.basePoolInfo !== undefined : true), {
  message: 'basePoolInfo is required for meta pool',
  path: ['basePoolInfo'],
});

export type PoolResponse = z.infer<typeof PoolResponseSchema>;
export type PoolRawResponse = z.input<typeof PoolResponseSchema>;
