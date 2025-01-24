import { SlippageSchema } from '../common/slippage';
import { AddressSchema, Asset, AssetSchema } from '@torch-finance/core';
import { z } from 'zod';
import { BigIntSchema, QueryId } from '../common/zod';

const SingleWithdrawModeSchema = z.literal('Single');
const BalancedWithdrawModeSchema = z.literal('Balanced');

const BaseWithdrawSchema = z.object({
  pool: AddressSchema,
  burnLpAmount: BigIntSchema,
  queryId: QueryId.optional(),
  recipient: AddressSchema.optional(),
  slippageTolerance: SlippageSchema.optional(),
  extraPayload: z.null().optional(),
});

const NextWithdrawSingleSchema = z.object({
  pool: AddressSchema,
  mode: SingleWithdrawModeSchema,
  withdrawAsset: z.union([AssetSchema.transform((v) => new Asset(v)), z.instanceof(Asset)]),
});

const NextWithdrawBalancedSchema = z.object({
  mode: BalancedWithdrawModeSchema,
  pool: AddressSchema,
});

const NextWithdrawSchema = z.union([NextWithdrawSingleSchema, NextWithdrawBalancedSchema]);

const SingleWithdrawBaseSchema = BaseWithdrawSchema.extend({
  mode: SingleWithdrawModeSchema,
});

// Single Withdraw Variant 1: With `withdrawAsset` and no `nextWithdraw`
const SingleWithdrawNoNextSchema = SingleWithdrawBaseSchema.merge(
  z.object({
    withdrawAsset: z.union([z.instanceof(Asset), AssetSchema.transform((v) => new Asset(v))]),
    nextWithdraw: z.undefined(),
  }),
);

// Single Withdraw Variant 2: With `nextWithdraw` and no `withdrawAsset`
const SingleWithdrawWithNextSchema = SingleWithdrawBaseSchema.merge(
  z.object({
    nextWithdraw: NextWithdrawSchema,
    withdrawAsset: z.undefined(),
  }),
).omit({
  withdrawAsset: true,
});

// Combine Single Withdraw Variants
const SingleWithdrawParamsSchema = z.union([SingleWithdrawNoNextSchema, SingleWithdrawWithNextSchema]);

const BalancedWithdrawParamsSchema = BaseWithdrawSchema.extend({
  mode: BalancedWithdrawModeSchema,
  nextWithdraw: NextWithdrawSchema.optional(),
});

export const WithdrawParamsSchema = z
  .union([SingleWithdrawParamsSchema, BalancedWithdrawParamsSchema])
  .transform((data) => {
    return {
      ...data,
      toJSON(): Record<string, unknown> {
        const serializeNextWithdraw = (nextWithdraw?: z.infer<typeof NextWithdrawSchema>) => {
          if (!nextWithdraw) return undefined;
          return {
            pool: nextWithdraw.pool.toString(),
            mode: nextWithdraw.mode,
            withdrawAsset:
              nextWithdraw.mode === 'Single' && nextWithdraw.withdrawAsset
                ? nextWithdraw.withdrawAsset.toJSON()
                : undefined,
          };
        };
        return {
          pool: data.pool.toString(),
          burnLpAmount: data.burnLpAmount.toString(),
          queryId: data.queryId === undefined ? undefined : data.queryId.toString(),
          recipient: data.recipient ? data.recipient.toString() : undefined,
          slippageTolerance: data.slippageTolerance?.toString(),
          extraPayload: data.extraPayload,
          nextWithdraw: serializeNextWithdraw(data.nextWithdraw),
        };
      },
    };
  });

export type WithdrawParams = z.input<typeof WithdrawParamsSchema>;
export type ParsedWithdrawParams = z.infer<typeof WithdrawParamsSchema>;
