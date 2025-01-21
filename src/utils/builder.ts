import { DepositNext, SwapNext, WithdrawNext } from '@torch-finance/dex-contract-wrapper';
import { Hop } from '../types/hop';
import { PoolType } from '../api/types/pool';
import { Allocation, Asset } from '@torch-finance/core';

export function buildSwapNext(hops: Hop[]): SwapNext | WithdrawNext | DepositNext | null {
  if (hops.length === 0) {
    return null;
  }
  const [firstRoute, ...restRoutes] = hops;
  if (firstRoute?.action === 'swap') {
    return {
      type: 'swap',
      nextPoolAddress: firstRoute.pool.address,
      assetOut: firstRoute.assetOut,
      next: buildSwapNext(restRoutes) as SwapNext | WithdrawNext,
    };
  } else if (firstRoute?.action === 'withdraw') {
    if (firstRoute.pool.type !== PoolType.BASE) {
      throw new Error('Withdraw next should be in a stable pool');
    }
    return {
      type: 'withdraw',
      nextPoolAddress: firstRoute.pool.address,
      config: {
        mode: 'single',
        assetOut: firstRoute.assetOut,
      },
    };
  } else if (firstRoute?.action === 'deposit') {
    const stablePool = firstRoute.pool.basePoolInfo;
    if (!stablePool) throw new Error('Pool in first hop should exist');
    return {
      type: 'deposit',
      nextPoolAddress: firstRoute.pool.address,
      metaAllocation: new Allocation({
        asset: firstRoute.pool.assets.find((asset) => !asset.equals(Asset.jetton(stablePool.address)))!,
        value: 0n,
      }),
    };
  }
  return null;
}
