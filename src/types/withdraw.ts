import { Address } from '@ton/core';
import { Slippage, SlippageSchema } from './slippage';
import { AddressSchema, Allocation, Asset, AssetSchema, Marshallable } from '@torch-finance/core';
import { z } from 'zod';

export type WithdrawMode = 'single' | 'balanced';

interface BaseWithdraw {
  pool: z.input<typeof AddressSchema>;
  burnLpAmount: bigint;
  queryId: bigint;
  slippageTolerance?: Slippage;
  minAmountOuts?: Allocation | Allocation[];
  extraPayload?: null; // TODO: implement extraPayload when referral is implemented
}

// Strictly define NextWithdraw based on mode
interface NextWithdrawSingleRaw {
  pool: z.input<typeof AddressSchema>;
  mode: 'single';
  withdrawAsset: z.input<typeof AssetSchema>; // Must be defined for single mode
}
interface NextWithdrawSingle {
  pool: Address;
  mode: 'single';
  withdrawAsset: Asset; // Must be defined for single mode
}

interface NextWithdrawBalancedRaw {
  pool: z.input<typeof AddressSchema>;
  mode: 'balanced';
  withdrawAsset?: never; // Must be undefined for balanced mode
}
interface NextWithdrawBalanced {
  pool: Address;
  mode: 'balanced';
  withdrawAsset?: never; // Must be undefined for balanced mode
}

export type NextWithdrawRaw = NextWithdrawSingleRaw | NextWithdrawBalancedRaw;
export type NextWithdraw = NextWithdrawSingle | NextWithdrawBalanced;

// single mode base type
interface SingleWithdrawBase extends BaseWithdraw {
  mode: 'single';
}

// Mutual exclusivity between withdrawAsset and nextWithdraw
export type SingleWithdrawWithNext = SingleWithdrawBase & {
  nextWithdraw: NextWithdrawRaw;
  withdrawAsset?: never; // Enforce withdrawAsset is undefined when nextWithdraw is defined
};

export type SingleWithdrawWithAsset = SingleWithdrawBase & {
  withdrawAsset: z.input<typeof AssetSchema>;
  nextWithdraw?: never; // Enforce nextWithdraw is undefined when withdrawAsset is defined
};

type SingleWithdrawParams = SingleWithdrawWithNext | SingleWithdrawWithAsset;

// balanced mode type
interface BalancedWithdrawParams extends BaseWithdraw {
  mode: 'balanced';
  nextWithdraw?: NextWithdrawRaw; // No restrictions for nextWithdraw in balanced mode
}

// Unified WithdrawParams type
export type WithdrawParams = SingleWithdrawParams | BalancedWithdrawParams;

export class Withdraw implements Marshallable {
  mode: WithdrawMode;
  pool: Address;
  burnLpAmount: bigint;
  queryId: bigint;
  slippageTolerance?: Slippage;
  minAmountOuts?: Allocation[];
  extraPayload?: null; // TODO: implement extraPayload when referral is implemented
  withdrawAsset?: Asset;
  nextWithdraw?: NextWithdraw;

  constructor(params: WithdrawParams) {
    this.mode = params.mode;
    this.pool = AddressSchema.parse(params.pool);
    this.burnLpAmount = params.burnLpAmount;
    this.queryId = params.queryId ?? 0n;
    this.slippageTolerance = params.slippageTolerance ? SlippageSchema.parse(params.slippageTolerance) : undefined;
    this.minAmountOuts = params.minAmountOuts ? Allocation.createAllocations(params.minAmountOuts) : undefined;
    this.extraPayload = params.extraPayload;

    if (params.mode === 'single' && !params.withdrawAsset && !params.nextWithdraw) {
      throw new Error('withdrawAsset must be defined when mode is single');
    }

    // if mode is single and nextWithdraw is defined, then withdrawAsset must be undefined
    // if mode is single and nextWithdraw is undefined, then withdrawAsset must be defined
    // if mode is balanced, then withdrawAsset must be undefined
    // if mode of nextWithdraw is single, then nextWithdraw.withdrawAsset must be defined
    // if mode of nextWithdraw is balanced, then nextWithdraw.withdrawAsset must be undefined

    // Validate parameters based on mode
    if (params.nextWithdraw) {
      const hasNextWithdrawAsset = Boolean(params.nextWithdraw?.withdrawAsset);
      const isNextModeSingle = params.nextWithdraw?.mode === 'single';
      const isNextModeBalanced = params.nextWithdraw?.mode === 'balanced';
      if (params.mode === 'single') {
        if (hasNextWithdrawAsset && isNextModeBalanced) {
          throw new Error('Next withdrawAsset must be undefined when nextWithdraw mode is balanced');
        }
        if (!hasNextWithdrawAsset && isNextModeSingle) {
          throw new Error('Next withdrawAsset must be defined when nextWithdraw mode is single');
        }

        this.withdrawAsset = undefined;
      } else if (params.mode === 'balanced') {
        if (isNextModeSingle && !hasNextWithdrawAsset) {
          throw new Error('Next withdrawAsset must be defined when nextWithdraw mode is single');
        }
        if (isNextModeBalanced && hasNextWithdrawAsset) {
          throw new Error('Next withdrawAsset must be undefined when nextWithdraw mode is balanced');
        }
        if (params.minAmountOuts || params.slippageTolerance) {
          throw new Error(
            'minAmountOuts and slippageTolerance are not supported in "withdraw all and withdraw next" for now',
          );
        }
      }
      if (params.nextWithdraw.mode === 'single') {
        this.nextWithdraw = {
          mode: 'single',
          pool: AddressSchema.parse(params.nextWithdraw.pool),
          withdrawAsset: new Asset(params.nextWithdraw.withdrawAsset),
        };
      } else {
        this.nextWithdraw = {
          mode: 'balanced',
          pool: AddressSchema.parse(params.nextWithdraw.pool),
        };
      }
    }

    if (params.mode === 'single' && !params.nextWithdraw) {
      this.withdrawAsset = new Asset(params.withdrawAsset);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      mode: this.mode,
      pool: this.pool.toString(),
      burnLpAmount: this.burnLpAmount.toString(),
      withdrawAsset: this.withdrawAsset ? this.withdrawAsset.toJSON() : undefined,
      nextWithdraw: this.nextWithdraw
        ? {
            pool: this.nextWithdraw.pool.toString(),
            mode: this.nextWithdraw.mode,
            withdrawAsset: this.nextWithdraw.withdrawAsset ? this.nextWithdraw.withdrawAsset.toJSON() : undefined,
          }
        : undefined,
      queryId: this.queryId === undefined ? undefined : this.queryId.toString(),
      slippageTolerance: this.slippageTolerance ? this.slippageTolerance.toString() : undefined,
      minAmountOuts: this.minAmountOuts ? this.minAmountOuts?.map((a) => a.toJSON()) : undefined,
      extraPayload: this.extraPayload,
    };
  }
}
