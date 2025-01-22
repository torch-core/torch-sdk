import { DepositNext, SwapNext, WithdrawNext } from '@torch-finance/dex-contract-wrapper';
import { Hop } from '../types/hop';
import { PoolType } from '../api/types/pool';
import { Allocation, Asset } from '@torch-finance/core';

/**
 * Build the next operation in the transaction sequence
 * @param hops - The hops to build the next operation
 * @param minAmountOuts - The minimum amount out for each hop
 * @returns The next operation in the transaction sequence
 */
export function buildSwapNext(hops: Hop[], minAmountOuts: bigint[]): SwapNext | WithdrawNext | DepositNext | null {
  if (hops.length === 0) {
    return null;
  }
  const [firstRoute, ...restRoutes] = hops;

  if (firstRoute?.action === 'swap') {
    /**
     * SwapNext
     * --> SwapNext
     * --> DepositNext
     */
    return {
      type: 'swap',
      nextPoolAddress: firstRoute.pool.address,
      assetOut: firstRoute.assetOut,
      minAmountOut: minAmountOuts[0],
      next: buildSwapNext(restRoutes, minAmountOuts.slice(1)) as SwapNext | WithdrawNext,
    };
  } else if (firstRoute?.action === 'withdraw') {
    /**
     * WithdrawNext
     * --> WithdrawNext
     */
    if (firstRoute.pool.type !== PoolType.BASE) {
      throw new Error('Withdraw next should be in a stable pool');
    }
    return {
      type: 'withdraw',
      nextPoolAddress: firstRoute.pool.address,
      config: {
        mode: 'single',
        minAmountOut: minAmountOuts[0],
        assetOut: firstRoute.assetOut,
      },
    };
  } else if (firstRoute?.action === 'deposit') {
    /**
     * DepositNext
     * --> DepositNext
     */
    const stablePool = firstRoute.pool.basePoolInfo;
    if (!stablePool) throw new Error('Pool in first hop should exist');
    return {
      type: 'deposit',
      nextPoolAddress: firstRoute.pool.address,
      metaAllocation: new Allocation({
        asset: firstRoute.pool.assets.find((asset) => !asset.equals(Asset.jetton(stablePool.address)))!,
        value: 0n,
      }),
      minLpAmount: minAmountOuts[0],
    };
  }
  return null;
}
