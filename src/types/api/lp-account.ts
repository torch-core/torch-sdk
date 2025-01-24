import { AddressSchema } from '@torch-finance/core';
import { z } from 'zod';

export const LpAccountResponseSchema = z.object({
  address: AddressSchema,
  createdAt: z.number(),
});

export type LpAccountRawResponse = z.input<typeof LpAccountResponseSchema>;
export type LpAccountResponse = z.infer<typeof LpAccountResponseSchema>;
