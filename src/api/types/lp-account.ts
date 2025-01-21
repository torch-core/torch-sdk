import { Address } from '@ton/core';
import { z } from 'zod';

export const LpAccountResponseSchema = z.object({
  address: z.union([z.string().transform(Address.parse), z.instanceof(Address)]),
  createdAt: z.number(),
});

export type LpAccountRawResponse = z.input<typeof LpAccountResponseSchema>;
export type LpAccountResponse = z.infer<typeof LpAccountResponseSchema>;
