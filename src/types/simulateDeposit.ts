import { SimulateDepositResult } from '@torch-finance/dex-contract-wrapper';

export type SimulateDepositResponse = {
  lpTokenOut: bigint;
  lpTotalSupplyAfter: bigint;
  minLpTokenOut?: bigint;
  details: SimulateDepositResult[];
};
