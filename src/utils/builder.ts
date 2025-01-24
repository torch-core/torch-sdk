import { DepositNext, SwapNext, WithdrawNext } from '@torch-finance/dex-contract-wrapper';
import { Allocation, Asset } from '@torch-finance/core';

import { Hop } from '../types/common';
import { PoolType } from '@torch-finance/dex-contract-wrapper';
/**
 * Build the next operation in the transaction sequence
 * @param hops - The hops to build the next operation
 * @param minAmountOuts - The minimum amount out for each hop
 * @returns The next operation in the transaction sequence
 */
export function buildSwapNext(hops: Hop[], minAmountOuts?: bigint[]): SwapNext | WithdrawNext | DepositNext | null {
  if (hops.length === 0) {
    return null;
  }
  const [firstRoute, ...restRoutes] = hops;

  if (firstRoute?.action === 'Swap') {
    /**
     * SwapNext
     * --> SwapNext
     * --> DepositNext
     */
    return {
      type: 'Swap',
      nextPoolAddress: firstRoute.pool.address,
      assetOut: firstRoute.assetOut,
      minAmountOut: minAmountOuts?.at(0),
      next: buildSwapNext(restRoutes, minAmountOuts?.slice(1)) as SwapNext | WithdrawNext,
    };
  } else if (firstRoute?.action === 'Withdraw') {
    /**
     * WithdrawNext
     * --> WithdrawNext
     */
    if (firstRoute.pool.type !== PoolType.Base) {
      throw new Error('Withdraw next should be in a stable pool');
    }
    return {
      type: 'Withdraw',
      nextPoolAddress: firstRoute.pool.address,
      config: {
        mode: 'Single',
        minAmountOut: minAmountOuts?.at(0),
        assetOut: firstRoute.assetOut,
      },
    };
  } else if (firstRoute?.action === 'Deposit') {
    /**
     * DepositNext
     * --> DepositNext
     */
    const stablePool = firstRoute.pool.basePool;
    if (!stablePool) throw new Error('Pool in first hop should exist');
    return {
      type: 'Deposit',
      nextPoolAddress: firstRoute.pool.address,
      metaAllocation: new Allocation({
        asset: firstRoute.pool.assets.find((asset) => !asset.asset.equals(Asset.jetton(stablePool.address)))!.asset,
        value: 0n,
      }),
      minLpAmount: minAmountOuts?.at(0),
    };
  }
  return null;
}
