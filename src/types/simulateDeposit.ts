import { SimulateDepositResult } from '@torch-finance/dex-contract-wrapper';

export type SimulateDepositResponse = {
  lpTokenOut: bigint;
  minLpTokenOut?: bigint;
  lpTotalSupplyAfter: bigint;
  details: SimulateDepositResult[];
};
