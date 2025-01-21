import { SlippageSchema } from './slippage';
import { ExtraPayload } from './extraPayload';
import { CallbackPayload } from './callbackPayload';
import { MinAmountOut, QueryId } from './common';
import { z } from 'zod';
import { AddressSchema, Allocation, AllocationSchema, Marshallable } from '@torch-finance/core';

const DepositBaseSchema = z.object({
  pool: AddressSchema,
  depositAmounts: z
    .union([AllocationSchema.array(), AllocationSchema])
    .transform((v) => Allocation.createAllocations(v)),
});

const DepositNextSchema = z.object({
  pool: AddressSchema,
  depositAmounts: AllocationSchema.optional().transform((v) => (v ? Allocation.createAllocations(v) : undefined)),
});

export const DepositParamsSchema = DepositBaseSchema.extend({
  slippageTolerance: SlippageSchema.optional(),
  minAmountOut: MinAmountOut.optional(),
  queryId: QueryId.optional(),
  recipient: AddressSchema.optional(),
  fulfillPayload: z.instanceof(CallbackPayload).optional(),
  rejectPayload: z.instanceof(CallbackPayload).optional(),
  extraPayload: z.instanceof(ExtraPayload).optional(),
  nextDeposit: DepositNextSchema.optional(),
})
  .superRefine((data, ctx) => {
    // Should not set both slippage tolerance and min amount out
    if (data.slippageTolerance !== undefined && data.minAmountOut !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cannot set both slippage tolerance and min amount out when constructing a deposit',
      });
    }
  })
  .transform((data) => {
    return {
      ...data,
      toJSON: (): object => {
        const toJSONIfDefined = <T>(value?: T & Marshallable) => (value ? value.toJSON() : undefined);
        const serializeNextDeposit = (nextDeposit?: z.infer<typeof DepositNextSchema>) => {
          if (!nextDeposit) return undefined;
          return {
            pool: nextDeposit.pool.toString(),
            depositAmounts: nextDeposit.depositAmounts ? nextDeposit.depositAmounts.map((a) => a.toJSON()) : undefined,
          };
        };

        return {
          pool: data.pool.toString(),
          depositAmounts: data.depositAmounts.map((a) => a.toJSON()),
          slippageTolerance: data.slippageTolerance?.toString(),
          queryId: data.queryId === undefined ? undefined : data.queryId.toString(),
          recipient: data.recipient ? data.recipient.toString() : undefined,
          fulfillPayload: toJSONIfDefined(data.fulfillPayload),
          rejectPayload: toJSONIfDefined(data.rejectPayload),
          extraPayload: toJSONIfDefined(data.extraPayload),
          nextDeposit: serializeNextDeposit(data.nextDeposit),
        };
      },
    };
  });

export type DepositParams = z.input<typeof DepositParamsSchema>;
export type ParsedDepositParams = z.infer<typeof DepositParamsSchema>;
