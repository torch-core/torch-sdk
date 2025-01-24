import { RatePayload } from '@torch-finance/core';

/**
 * If the pool useRate = false, then the pool rate payload is null
 */
export type PoolsRatePayloads = (RatePayload | null)[];
