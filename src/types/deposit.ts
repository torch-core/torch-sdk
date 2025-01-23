import { SlippageSchema } from './slippage';
import { QueryId } from './common';
import { z } from 'zod';
import { AddressSchema, Allocation, AllocationSchema } from '@torch-finance/core';
import { Cell } from '@ton/core';

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
  // minAmountOut: MinAmountOut.optional(), // TODO: Add simulate exact out deposit in simulator first
  queryId: QueryId.optional(),
  recipient: AddressSchema.optional(),
  fulfillPayload: z.instanceof(Cell).optional(),
  rejectPayload: z.instanceof(Cell).optional(),
  extraPayload: z.null().optional(), // TODO: support extra payload when referral program is implemented
  nextDeposit: DepositNextSchema.optional(),
})
  // .superRefine((data, ctx) => {
  //   // Should not set both slippage tolerance and min amount out
  //   if (data.slippageTolerance !== undefined && data.minAmountOut !== undefined) {
  //     ctx.addIssue({
  //       code: z.ZodIssueCode.custom,
  //       message: 'Cannot set both slippage tolerance and min amount out when constructing a deposit',
  //     });
  //   }
  // })
  .transform((data) => {
    return {
      ...data,
      toJSON: (): object => {
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
          fulfillPayload: data.fulfillPayload?.toString(),
          rejectPayload: data.rejectPayload?.toString(),
          extraPayload: data.extraPayload, // TODO: support extra payload when referral program is implemented
          nextDeposit: serializeNextDeposit(data.nextDeposit),
        };
      },
    };
  });

export type DepositParams = z.input<typeof DepositParamsSchema>;
export type ParsedDepositParams = z.infer<typeof DepositParamsSchema>;
