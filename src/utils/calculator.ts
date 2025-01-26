import Decimal from 'decimal.js';

export function calculateMinAmountOutBySlippage(amountOut: bigint, slippageTolerance: Decimal): bigint {
  const slippageMultiplier = new Decimal(1).minus(slippageTolerance.toNumber());
  const minAmountOut = BigInt(slippageMultiplier.mul(amountOut.toString()).ceil().toFixed(0));
  return minAmountOut;
}
/**
 * Calculates the execution price based on the amountIn and amountOut.
 *
 * This method converts the given amountIn and amountOut from BigInt to Decimal for precise calculation.
 * It then calculates the execution price by dividing amountIn by amountOut.
 *
 * @param amountIn - The amount of asset being input into the transaction.
 * @param amountOut - The amount of asset being output from the transaction.
 * @returns The execution price as a Decimal value. (1 amountIn = amountOut amountOut)
 */
export function calculateExecutionPrice(
  tokenIn: { amount: bigint; decimals: number },
  tokenOut: { amount: bigint; decimals: number },
): string {
  // Convert amounts to decimal for precise calculation
  const amountInDecimal = new Decimal(tokenIn.amount.toString()).div(10 ** tokenIn.decimals);
  const amountOutDecimal = new Decimal(tokenOut.amount.toString()).div(10 ** tokenOut.decimals);

  // Calculate price as amountIn/amountOut
  return amountInDecimal.div(amountOutDecimal).toFixed(9);
}
