import { Asset, normalize } from '@torch-finance/core';
import { Allocation } from '@torch-finance/core';

/**
 * Normalizes the allocations by ensuring that all assets in the pool are represented,
 * even if their amount is zero. It also sorts the allocations by asset.
 *
 * @param allocations - The current list of allocations.
 * @param assets - The list of assets in the pool.
 * @returns An array of normalized allocations, where each asset is represented.
 */
export const normalizeAllocations = (allocations: Allocation[], assets: Asset[]): Allocation[] => {
  const normalized: Allocation[] = normalize(allocations, assets);
  normalized.sort((a, b) => a.asset.compare(b.asset));
  return normalized;
};
