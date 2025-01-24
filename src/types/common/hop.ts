import { Asset, AssetSchema } from '@torch-finance/core';
import { z } from 'zod';
import { PoolResponseSchema } from '../api/pool';
export enum HopAction {
  SWAP = 'Swap',
  DEPOSIT = 'Deposit',
  WITHDRAW = 'Withdraw',
}

export const HopSchema = z.object({
  action: z.nativeEnum(HopAction),
  pool: PoolResponseSchema,
  assetIn: AssetSchema.transform((asset) => new Asset(asset)),
  assetOut: AssetSchema.transform((asset) => new Asset(asset)),
});

export type Hop = z.infer<typeof HopSchema>;
export type HopRaw = z.input<typeof HopSchema>;
