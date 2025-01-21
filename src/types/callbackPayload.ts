import { Cell } from '@ton/core';
import { beginCell } from '@ton/core';
import { Marshallable } from '@torch-finance/core';
import { z } from 'zod';

export const CallbackPayloadSchema = z.object({
  sendTON: z.bigint().positive(),
  sendPayload: z.instanceof(Cell),
});

export type CallbackPayloadParams = z.input<typeof CallbackPayloadSchema>;

export class CallbackPayload implements z.infer<typeof CallbackPayloadSchema>, Marshallable {
  sendTON: bigint;
  sendPayload: Cell;

  constructor(params: CallbackPayloadParams) {
    const parsed = CallbackPayloadSchema.parse(params);
    this.sendTON = parsed.sendTON;
    this.sendPayload = parsed.sendPayload;
  }

  toCell(): Cell {
    return beginCell().storeCoins(this.sendTON).storeRef(this.sendPayload).endCell();
  }

  toJSON(): Record<string, unknown> {
    return {
      sendTON: this.sendTON.toString(),
      sendPayload: this.sendPayload.toBoc().toString('hex'),
    };
  }
}
