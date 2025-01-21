import { z } from 'zod';
import { Maybe } from '@ton/core/dist/utils/maybe';
import { Cell, Dictionary } from '@ton/core';
import { Marshallable } from '@torch-finance/core';

export const ExtraPayloadSchema = z.object({
  referralId: z.string().optional(),
});

export type ExtraPayloadParams = z.input<typeof ExtraPayloadSchema>;

export class ExtraPayload implements ExtraPayloadParams, Marshallable {
  referralId?: string;

  constructor(params: ExtraPayloadParams) {
    const parsed = ExtraPayloadSchema.parse(params);
    this.referralId = parsed.referralId;
  }

  toDict(): Maybe<Dictionary<bigint, Cell>> {
    // TODO: implement toDict @0xthrow-unless
    return Dictionary.empty();
  }

  toJSON(): Record<string, unknown> {
    return {
      referralId: this.referralId,
    };
  }
}
