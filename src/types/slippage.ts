import Decimal from 'decimal.js';
import { z } from 'zod';

export const SlippageSchema = z
  .custom<Decimal.Value>((data) => {
    return data;
  })
  .transform((data) => {
    return new Decimal(data);
  })
  .refine((data) => {
    return data.gte(0) && data.lte(1);
  }, 'Slippage tolerance must between 0 and 1');

export type Slippage = z.infer<typeof SlippageSchema>;
