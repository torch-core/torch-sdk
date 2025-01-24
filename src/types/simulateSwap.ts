import { SimulateSwapExactInResult, SimulateSwapExactOutResult } from '@torch-finance/dex-contract-wrapper';

interface BaseSimulateSwapResponse {
  minAmountOut: bigint | undefined;
  details: SimulateSwapExactInResult[] | SimulateSwapExactOutResult[];
  executionPrice: string;
}

export interface SimulateSwapExactInResponse extends BaseSimulateSwapResponse {
  mode: 'ExactIn';
  amountOut: bigint;
}

export interface SimulateSwapExactOutResponse extends BaseSimulateSwapResponse {
  mode: 'ExactOut';
  amountIn: bigint;
}

export type SimulateSwapResponse = SimulateSwapExactInResponse | SimulateSwapExactOutResponse;
