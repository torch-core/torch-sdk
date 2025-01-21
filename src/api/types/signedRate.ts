import { Maybe } from '@ton/core/dist/utils/maybe';

export type SignedRateResponse = {
  signatures: string; // Buffer hex string
  payload: string; // RatePayload cell boc hex string
  nextSignedRate?: Maybe<SignedRateResponse>;
};
