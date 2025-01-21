import { z } from 'zod';
import { AddressSchema, Allocation, AllocationSchema, Asset, AssetSchema } from '@torch-finance/core';
import { BigIntLike } from '../../types/common';

export enum PoolType {
  BASE = 'Base',
  META = 'Meta',
}

export const BasePoolInfoSchema = z.object({
  type: z.nativeEnum(PoolType),
  address: AddressSchema,
  lpAsset: AssetSchema.transform((asset) => new Asset(asset)),
  assets: z.array(AssetSchema).transform((assets) => assets.map((asset) => new Asset(asset))),
  useRates: z.boolean(),
  initA: z.number(),
  futureA: z.number(),
  initATime: z.number(),
  futureATime: z.number(),
  feeNumerator: z.number(),
  adminFeeNumerator: z.number(),
  adminFees: z.array(AllocationSchema).transform((adminFees) => adminFees.map((adminFee) => new Allocation(adminFee))),
  reserves: z.array(AllocationSchema).transform((reserves) => reserves.map((reserve) => new Allocation(reserve))),
  lpTotalSupply: BigIntLike,
  decimals: z.array(AllocationSchema).transform((decimals) => decimals.map((decimal) => new Allocation(decimal))),
  rates: z
    .array(AllocationSchema)
    .optional()
    .transform((rates) => rates?.map((rate) => new Allocation(rate))),
});

export const PoolResponseSchema = BasePoolInfoSchema.extend({
  basePoolInfo: BasePoolInfoSchema.optional(),
}).refine((data) => (data.type === PoolType.META ? data.basePoolInfo !== undefined : true), {
  message: 'basePoolInfo is required for meta pool',
  path: ['basePoolInfo'],
});

export type PoolResponse = z.infer<typeof PoolResponseSchema>;
export type PoolRawResponse = z.input<typeof PoolResponseSchema>;
