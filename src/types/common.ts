import { z } from 'zod';

export const QueryId = z.bigint().nonnegative();
export const MinAmountOut = z.bigint().nonnegative();
export const BigIntLike = z.union([z.bigint(), z.string().transform((v) => BigInt(v))]);
