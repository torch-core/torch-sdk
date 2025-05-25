import { z } from 'zod';
import { Asset, AddressSchema } from '@torch-finance/core';
import { MinAmountOut } from '../common/zod';
import { QueryId } from '../common/zod';
import { SlippageSchema } from '../common/slippage';
import { Cell, Dictionary } from '@ton/core';
import Decimal from 'decimal.js';

const GeneralSwapParamsSchema = z.object({
  assetIn: z.instanceof(Asset),
  assetOut: z.instanceof(Asset),
  routes: z.array(AddressSchema).optional(),
  queryId: QueryId.optional().transform((v) => v ?? 0n),
  deadline: z.bigint().optional(),
  slippageTolerance: z.union([SlippageSchema, z.instanceof(Decimal).refine((v) => v.gte(0) && v.lte(1))]).optional(),
  minAmountOut: MinAmountOut.optional(),
  recipient: AddressSchema.optional(),
  fulfillPayload: z.instanceof(Cell).optional(),
  rejectPayload: z.instanceof(Cell).optional(),
  extraPayload: z.custom<Dictionary<bigint, Cell>>().nullish(),
});

export const ExactInParamsSchema = GeneralSwapParamsSchema.extend({
  mode: z.literal('ExactIn'),
  amountIn: z.bigint().nonnegative(),
});

export const ExactOutParamsSchema = GeneralSwapParamsSchema.extend({
  mode: z.literal('ExactOut'),
  amountOut: z.bigint().nonnegative(),
});

export const SwapParamsSchema = z
  .discriminatedUnion('mode', [ExactInParamsSchema, ExactOutParamsSchema])
  .superRefine((data, ctx) => {
    // Do not allow slippage tolerance and min amount out to be set at the same time
    if (data.slippageTolerance && data.minAmountOut) {
      // If min amount out is set, slippage tolerance is ignored
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Slippage tolerance and min amount out cannot be set at the same time',
      });
    }
    // Do not allow asset in equals asset out
    const assetIn = data.assetIn;
    const assetOut = data.assetOut;
    if (assetIn.equals(assetOut)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Asset in and out must be different',
      });
    }
  })
  .transform((data) => {
    return {
      ...data,
      toJSON: (): object => {
        return {
          mode: data.mode,
          assetIn: data.assetIn.toJSON(),
          assetOut: data.assetOut.toJSON(),
          routes: data.routes ? data.routes?.map((r) => r.toString()) : undefined,
          amountIn: data.mode === 'ExactIn' ? data.amountIn?.toString() : undefined,
          amountOut: data.mode === 'ExactOut' ? data.amountOut?.toString() : undefined,
          queryId: data.queryId.toString(),
          deadline: data.deadline?.toString(),
          slippageTolerance: data.slippageTolerance ? data.slippageTolerance.toString() : undefined,
          minAmountOut: data.minAmountOut ? data.minAmountOut.toString() : undefined,
          recipient: data.recipient ? data.recipient.toString() : undefined,
          fulfillPayload: data.fulfillPayload ? data.fulfillPayload : undefined,
          rejectPayload: data.rejectPayload ? data.rejectPayload : undefined,
          extraPayload: data.extraPayload ? data.extraPayload : undefined,
        };
      },
    };
  });

export type SwapParams = z.input<typeof SwapParamsSchema>;
export type ParsedSwapParams = z.infer<typeof SwapParamsSchema>;
export type SwapMode = ParsedSwapParams['mode'];
