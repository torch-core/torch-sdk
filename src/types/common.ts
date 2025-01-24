import { z } from 'zod';

export const MinAmountOut = z.bigint().nonnegative();
export const BigIntSchema = z.union([
  z.bigint(),
  z.number().transform((v) => BigInt(v.toString())),
  z.string().transform((v) => BigInt(v)),
]);
export const QueryId = z.union([
  z.bigint().nonnegative(),
  z
    .number()
    .nonnegative()
    .transform((v) => BigInt(v.toString())),
  z
    .string()
    .transform((v) => BigInt(v))
    .refine((v) => v >= 0n, 'QueryId must be nonnegative'),
]);
