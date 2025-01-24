import { SimulateDepositResult } from '@torch-finance/dex-contract-wrapper';

/**
 * Response type for deposit simulations
 */
export type SimulateDepositResponse = {
  /**
   * Amount of LP tokens that will be minted for this deposit
   */
  lpTokenOut: bigint;
  /**
   * Minimum LP tokens to receive, considering slippage tolerance
   */
  minLpTokenOut?: bigint;
  /**
   * Total supply of LP tokens after this deposit would be executed
   */
  lpTotalSupplyAfter: bigint;
  /**
   * Detailed simulation results from each step of the deposit
   */
  details: SimulateDepositResult[];
};
