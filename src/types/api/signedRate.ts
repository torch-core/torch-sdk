export type SignedRateResponse = {
  signatures: string; // Buffer hex string
  payload: string; // RatePayload cell boc hex string
  nextSignedRate?: SignedRateResponse | null;
};
