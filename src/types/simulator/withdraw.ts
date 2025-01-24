import { SimulateWithdrawResult } from '@torch-finance/dex-contract-wrapper';
import { Allocation } from '@torch-finance/core';

export type SimulateWithdrawResponse = {
  /**
   * The amounts of assets that will be received from the withdrawal
   */
  amountOuts: Allocation[];

  /**
   * The minimum amounts of assets that will be received, considering slippage tolerance
   */
  minAmountOuts?: Allocation[];

  /**
   * Detailed simulation results for each pool involved in the withdrawal
   */
  details: SimulateWithdrawResult[];
};
