import { Address } from '@ton/core';
import { SimulateSwapExactInResult, SimulateSwapExactOutResult } from '@torch-finance/dex-contract-wrapper';

interface BaseSimulateSwapResponse {
  /**
   * Routes used for the swap
   */
  routes: Address[];
  /**
   * Minimum amount that must be received, considering slippage tolerance
   */
  minAmountOut: bigint | undefined;
  /**
   * Detailed simulation results from each step of the swap
   */
  details: SimulateSwapExactInResult[] | SimulateSwapExactOutResult[];
  /**
   * The effective exchange rate for the swap
   */
  executionPrice: string;
}

export interface SimulateSwapExactInResponse extends BaseSimulateSwapResponse {
  /**
   * Identifies this as an ExactIn swap
   */
  mode: 'ExactIn';
  /**
   * The calculated output amount from the swap
   */
  amountOut: bigint;
}

export interface SimulateSwapExactOutResponse extends BaseSimulateSwapResponse {
  /**
   * Identifies this as an ExactOut swap
   */
  mode: 'ExactOut';
  /**
   * The required input amount for the swap
   */
  amountIn: bigint;
}

export type SimulateSwapResponse = SimulateSwapExactInResponse | SimulateSwapExactOutResponse;
