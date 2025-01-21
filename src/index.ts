import { Factory, SimulatorSwapResult, SwapNext, WithdrawNext } from '@torch-finance/dex-contract-wrapper';
import { ITorchAPI, TorchAPI } from './api';
import { Address, OpenedContract, SenderArguments } from '@ton/core';
import { TonClient4 } from '@ton/ton';
import { DepositParams } from './types/deposit';
import { DepositParamsSchema } from './types/deposit';
import { PoolResponse } from './api/types/pool';
import Decimal from 'decimal.js';
import { Allocation, Asset, normalize, SignedRate } from '@torch-finance/core';
import { Withdraw, WithdrawParams } from './types/withdraw';
import { ExactInParamsSchema, SwapParamsSchema } from './types/swap';
import { SwapParams } from './types/swap';
import { Hop, HopAction, HopSchema } from './types/hop';
import { buildSwapNext } from './utils/builder';
import { Simulator } from './simulate';

export type TorchSDKOptions = {
  indexerEndpoint?: string;
  oracleEndpoint?: string;
  client?: TonClient4;
  factoryAddress?: Address;
};

export class TorchSDK {
  public readonly tonClient: TonClient4;
  public readonly api: ITorchAPI;
  private readonly factory: OpenedContract<Factory>;
  private readonly simulator: Simulator;
  private cachedPools: PoolResponse[];

  constructor(readonly options: TorchSDKOptions) {
    // Fill in the default values (if not provided)
    const factoryAddress = options.factoryAddress || Address.parse('factory');
    const indexerEndpoint = options.indexerEndpoint || 'https://indexer.torch.finance';
    const oracleEndpoint = options.oracleEndpoint || 'https://oracle.torch.finance';

    // Intialization
    this.tonClient =
      options.client ||
      new TonClient4({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      });
    this.api = new TorchAPI({
      indexerEndpoint,
      oracleEndpoint,
    });
    this.simulator = new Simulator({
      torchAPI: this.api,
      tonClient: this.tonClient,
      mode: 'offchain',
    });
    this.factory = this.tonClient.open(Factory.createFromAddress(factoryAddress));
    this.cachedPools = [];
  }

  /**
   * Synchronizes the pool information with the latest data.
   *
   * You can manually provide pool information to synchronize
   *
   * If no pool information is provided, data will be fetched from the API.
   *
   * @param pools Optional array of `PoolInfo` objects to override, if not provided, data will be fetched from the API.
   * @returns Resolves when the synchronization is complete.
   */
  async sync(): Promise<void> {
    this.cachedPools = await this.api.getPools();
  }

  // Get pool data by addresses
  private async getPools(addresses: Address[]): Promise<PoolResponse[]> {
    const poolInfos = await Promise.all(
      addresses.map(async (address) => {
        let pool = this.cachedPools.find((p) => p.address.equals(address));
        if (!pool) {
          await this.sync();
          pool = this.cachedPools.find((p) => p.address.equals(address));
        }
        if (!pool) throw new Error(`Pool not found: ${address.toString()}`);
        return pool;
      }),
    );
    return poolInfos;
  }

  private getSignedRates = async (pools: PoolResponse[]): Promise<SignedRate | null> => {
    const poolWithRates = pools.filter((pool) => !!pool && pool.useRates).map((pool) => pool!.address);
    if (poolWithRates.length === 0) {
      return null;
    }
    const signedRated = await this.api.getSignedRates(poolWithRates);
    return signedRated;
  };

  private _resolveHopsByRoutes(routes: PoolResponse[], assetIn: Asset, assetOut: Asset): Hop[] {
    function calHopAction(
      currentPool: PoolResponse,
      currentAssetIn: Asset,
      assetOut: Asset,
      currentPoolLpAsset: Asset,
    ): HopAction {
      if (currentPool.assets.some((asset) => asset.equals(currentAssetIn)) && assetOut.equals(currentPoolLpAsset)) {
        return HopAction.DEPOSIT; // pool asset -> lp asset
      } else if (
        currentPool.assets.some((asset) => asset.equals(currentAssetIn)) &&
        currentPool.assets.some((asset) => asset.equals(assetOut))
      ) {
        return HopAction.SWAP; // pool asset -> pool asset
      } else if (
        currentAssetIn.equals(currentPoolLpAsset) &&
        currentPool.assets.some((asset) => asset.equals(assetOut))
      ) {
        return HopAction.WITHDRAW; // lp asset -> pool asset
      }
      throw new Error('Unable to determine route action');
    }

    let currentAssetIn = assetIn;
    const hops: Hop[] = [];

    for (const [i, currentPool] of routes.entries()) {
      const currentPoolAssets = [...currentPool.assets, Asset.jetton(currentPool.address)];
      const currentPoolLpAsset = Asset.jetton(currentPool.address);

      if (i < routes.length - 1) {
        const nextPool = routes[i + 1]!;
        const nextPoolAssets = [...nextPool.assets, Asset.jetton(nextPool.address)];

        const currentPoolPossibleAssets = currentPoolAssets.filter((asset) => !asset.equals(currentAssetIn));

        const intersection = currentPoolPossibleAssets.filter((asset) =>
          nextPoolAssets.some((nextAsset) => nextAsset.equals(asset)),
        );

        if (intersection.length === 0) {
          throw new Error('No valid operation found to connect pools');
        }

        const selectedAssetOut = intersection[0];
        const action = calHopAction(currentPool, currentAssetIn, selectedAssetOut!, currentPoolLpAsset);

        hops.push(
          HopSchema.parse({
            action: action as HopAction,
            pool: currentPool,
            assetIn: currentAssetIn,
            assetOut: selectedAssetOut!,
          }),
        );
        currentAssetIn = selectedAssetOut!;
      } else {
        const action = calHopAction(currentPool, currentAssetIn, assetOut, currentPoolLpAsset);

        hops.push(
          HopSchema.parse({
            action: action as HopAction,
            pool: currentPool,
            assetIn: currentAssetIn,
            assetOut: assetOut,
          }),
        );
      }
    }

    return hops;
  }
  /**
   * Generates the payload required to perform a token deposit operation.
   *
   * This function parses the deposit parameters, ensures pool data is synchronized,
   * calculates the minimum amount of LP tokens out if slippage tolerance is provided,
   * retrieves necessary pool information, and generates payloads for deposit execution.
   *
   * @param {Address} sender - The address of the sender initiating the deposit.
   * @param {DepositParams} params - The parameters for the deposit, including the target pool, amounts, and optional next deposit information.
   * @returns {Promise<SenderArguments[]>} - A promise that resolves to an array of deposit payloads, ready to be signed and executed.
   *
   * @throws {Error} Throws an error if base pool information is not found for a meta-pool deposit.
   */
  getDepositPayload = async (sender: Address, params: DepositParams): Promise<SenderArguments[]> => {
    const parsedParams = DepositParamsSchema.parse(params);

    const pools = await this.getPools(
      [parsedParams.pool, parsedParams.nextDeposit?.pool].filter((pool) => pool !== undefined),
    );
    const [pool, nextPool] = pools as [PoolResponse, PoolResponse | undefined];
    const signedRates = await this.getSignedRates(pools);

    // Normalize allocations and meta allocation
    const poolAllocations: Allocation[] = normalize(parsedParams.depositAmounts, pool.assets);
    const metaAsset = nextPool?.assets.find((asset) => asset.jettonMaster?.equals(pool.address));
    const metaAllocation = metaAsset
      ? parsedParams.nextDeposit?.depositAmounts?.at(0) || new Allocation({ asset: metaAsset, value: BigInt(0) })
      : undefined;

    // Validate next deposit
    if (parsedParams.nextDeposit) {
      if (!nextPool) throw new Error(`Next pool ${parsedParams.nextDeposit?.pool} not found`);
      if (!metaAsset) throw new Error(`Meta asset is missing in next pool ${nextPool.address}`);
      if (!metaAllocation) throw new Error(`Meta allocation is missing in next pool ${nextPool.address}`);
    }

    // Calculate minAmountOut, nextMinAmountOut for the current pool and the next pool
    let minAmountOut: bigint | null = null;
    let nextMinAmountOut: bigint | null = null;
    if (parsedParams.slippageTolerance) {
      const simulateResult = await this.simulator.deposit(pool.address, {
        depositAmounts: poolAllocations,
        rates: signedRates?.payload.rates,
      });
      minAmountOut = BigInt(
        new Decimal(1 - parsedParams.slippageTolerance.toNumber()).mul(simulateResult.lpTokenOut.toString()).toFixed(0),
      );
      if (parsedParams.nextDeposit) {
        const nextAllocations = [
          {
            value: simulateResult.lpTokenOut,
            asset: Asset.jetton(pool.address),
          },
          metaAllocation!,
        ];

        const nextSimulateResult = await this.simulator.deposit(nextPool!.address, {
          depositAmounts: Allocation.createAllocations(nextAllocations),
          rates: signedRates?.payload.rates,
        });

        nextMinAmountOut = BigInt(
          new Decimal(1 - parsedParams.slippageTolerance.toNumber())
            .mul(nextSimulateResult.lpTokenOut.toString())
            .toFixed(0),
        );
      }
    }

    const senderArgs = await this.factory.getDepositPayload(sender, {
      queryId: params.queryId || 0n,
      poolAddress: pool.address,
      poolAllocations,
      config: {
        signedRate: signedRates,
        minLpAmount: minAmountOut,
        recipient: parsedParams.recipient,
        fulfillPayload: parsedParams.fulfillPayload,
        rejectPayload: parsedParams.rejectPayload,
        extraPayload: parsedParams.extraPayload,
      },
      next: parsedParams.nextDeposit
        ? {
            type: 'deposit',
            nextPoolAddress: nextPool!.address,
            metaAllocation: metaAllocation!,
            minLpAmount: nextMinAmountOut,
          }
        : null,
    });
    return senderArgs;
  };

  async getWithdrawPayload(sender: Address, params: WithdrawParams): Promise<SenderArguments> {
    const parsedParams = new Withdraw(params);

    const pools = await this.getPools(
      [parsedParams.pool, parsedParams.nextWithdraw?.pool].filter((pool) => pool !== undefined),
    );
    const [pool, nextPool] = pools as [PoolResponse, PoolResponse | undefined];
    const signedRates = await this.getSignedRates(pools);

    // Get minAmountOuts if slippageTolerance is provided
    let minAmountOuts: Allocation[] | null = null;
    let nextMinAmountOuts: Allocation[] | null = null;

    // Validate next withdraw requirements
    if (parsedParams.nextWithdraw) {
      if (!nextPool) throw new Error(`Next pool ${parsedParams.nextWithdraw?.pool} not found`);
    }

    // Calculate minAmountOuts
    if (parsedParams.slippageTolerance) {
      const simulateResult = await this.simulator.withdraw(pool.address, {
        lpAmount: parsedParams.burnLpAmount,
        assetOut: parsedParams.withdrawAsset,
        rates: signedRates?.payload.rates,
      });
      if (parsedParams.mode === 'balanced' && simulateResult.amountOuts.length !== pool.assets.length) {
        throw new Error(`In balanced mode, amount out length must match pool assets length (${pool.assets.length})`);
      }
      if (parsedParams.mode === 'single' && simulateResult.amountOuts.length !== 1) {
        throw new Error('In single mode, amount out length must be 1');
      }
      minAmountOuts = Allocation.createAllocations(
        pool.assets.map((asset, i) => ({
          asset,
          value: simulateResult.amountOuts[i]!,
        })),
      );

      if (parsedParams.nextWithdraw) {
        const nextLpIndex = pool.assets.findIndex((asset) => asset.jettonMaster?.equals(nextPool!.address));
        if (nextLpIndex === -1) throw new Error('Next pool LP asset not found');
        const nextLpAmount = simulateResult.amountOuts[nextLpIndex];
        if (nextLpAmount === undefined) throw new Error('Next pool LP amount not found');

        const nextSimulateResult = await this.simulator.withdraw(nextPool!.address, {
          lpAmount: nextLpAmount,
          assetOut: parsedParams.withdrawAsset,
          rates: signedRates?.payload.rates,
        });
        if (parsedParams.mode === 'balanced' && nextSimulateResult.amountOuts.length !== nextPool!.assets.length) {
          throw new Error(
            `In balanced mode, amount out length must match pool assets length (${nextPool!.assets.length})`,
          );
        }
        if (parsedParams.mode === 'single' && nextSimulateResult.amountOuts.length !== 1) {
          throw new Error('In single mode, amount out length must be 1');
        }
        nextMinAmountOuts = nextPool
          ? Allocation.createAllocations(
              nextPool.assets.map((asset, i) => ({
                asset,
                value: nextSimulateResult.amountOuts[i]!,
              })),
            )
          : null;
      }
    }

    const senderArgs = await this.factory.getWithdrawPayload(sender, {
      queryId: params.queryId,
      poolAddress: pool.address,
      burnLpAmount: parsedParams.burnLpAmount,
      signedRate: signedRates,
      extraPayload: parsedParams.extraPayload?.toDict(),
      config:
        parsedParams.mode === 'single'
          ? {
              mode: 'single',
              assetOut: parsedParams.withdrawAsset!,
              minAmountOut: minAmountOuts?.at(0)?.value,
            }
          : {
              mode: 'balanced',
              minAmountOuts: minAmountOuts,
            },
      next: parsedParams.nextWithdraw
        ? {
            type: 'withdraw',
            nextPoolAddress: nextPool!.address,
            config:
              parsedParams.nextWithdraw.mode === 'single'
                ? {
                    mode: 'single',
                    minAmountOut: nextMinAmountOuts?.at(0)?.value,
                    assetOut: parsedParams.withdrawAsset!,
                  }
                : {
                    mode: 'balanced',
                    minAmountOuts: nextMinAmountOuts,
                  },
          }
        : null,
    });
    return senderArgs;
  }

  async getSwapPayload(sender: Address, params: SwapParams): Promise<SenderArguments> {
    const parsedParams = SwapParamsSchema.parse(params);
    /*
     * Get hops
     * - If routes are provided, resolve hops by routes
     * - Otherwise, get hops from API
     */
    let hops: Hop[] = [];
    if (parsedParams.routes && parsedParams.routes.length > 0) {
      const pools = await this.getPools(parsedParams.routes);
      hops = this._resolveHopsByRoutes(pools, parsedParams.assetIn, parsedParams.assetOut);
    } else {
      hops = await this.api.getHops(parsedParams.assetIn, parsedParams.assetOut);
    }

    const [firstHop, ...restHops] = hops;
    if (!firstHop) throw new Error('No hops found');

    // Get signed rates
    const signedRates = await this.getSignedRates(hops.map((hop) => hop.pool));

    // Handle slippage tolerance
    let minAmountOut = parsedParams.minAmountOut;
    if (parsedParams.slippageTolerance) {
      let simulateResult: SimulatorSwapResult;
      if (parsedParams.mode === 'ExactIn') {
        simulateResult = await this.simulator.swap(hops[0]!.pool.address, {
          assetIn: parsedParams.assetIn,
          assetOut: parsedParams.assetOut,
          amount: parsedParams.amountIn,
          rates: signedRates?.payload.rates,
        });
      } else {
        simulateResult = await this.simulator.swap(hops[0]!.pool.address, {
          assetIn: parsedParams.assetIn,
          assetOut: parsedParams.assetOut,
          amount: parsedParams.amountOut,
          rates: signedRates?.payload.rates,
        });
      }
      minAmountOut = BigInt(
        new Decimal(1 - parsedParams.slippageTolerance.toNumber()).mul(simulateResult.amountOut.toString()).toFixed(0),
      );
    }

    const parsedExactInParams = ExactInParamsSchema.parse(parsedParams);
    if (firstHop.action === 'swap') {
      return await this.factory.getSwapPayload(sender, {
        queryId: parsedParams.queryId,
        poolAddress: firstHop.pool.address,
        assetIn: firstHop.assetIn,
        assetOut: firstHop.assetOut,
        amountIn: parsedExactInParams.amountIn,
        config: {
          deadline: parsedParams.deadline,
          minAmountOut: minAmountOut,
          recipient: parsedParams.recipient,
          signedRate: signedRates,
          fulfillPayload: parsedParams.fulfillPayload?.toCell(),
          rejectPayload: parsedParams.rejectPayload?.toCell(),
          extraPayload: parsedParams.extraPayload?.toDict(),
        },
        next: buildSwapNext(restHops) as SwapNext | WithdrawNext,
      });
    }
    if (firstHop.action === 'deposit') {
      const senderArgs = await this.factory.getDepositPayload(sender, {
        queryId: parsedParams.queryId,
        poolAddress: firstHop.pool.address,
        poolAllocations: Allocation.createAllocations(
          firstHop.pool.assets.map((asset) => ({
            asset,
            value: asset.equals(firstHop.assetIn) ? parsedExactInParams.amountIn : BigInt(0),
          })),
        ),
        config: {
          minLpAmount: minAmountOut,
          signedRate: signedRates,
          recipient: parsedParams.recipient,
          fulfillPayload: parsedParams.fulfillPayload?.toCell(),
          rejectPayload: parsedParams.rejectPayload?.toCell(),
          extraPayload: parsedParams.extraPayload?.toDict(),
        },
      });
      if (senderArgs.length === 0) throw new Error('No sender arguments found');
      return senderArgs[0]!;
    }
    if (firstHop.action === 'withdraw') {
      return await this.factory.getWithdrawPayload(sender, {
        queryId: parsedParams.queryId,
        poolAddress: firstHop.pool.address,
        burnLpAmount: parsedExactInParams.amountIn,
        config: {
          mode: 'single',
          assetOut: firstHop.assetOut,
          minAmountOut: minAmountOut,
        },
      });
    }
    throw new Error(`Invalid action: ${firstHop.action}`);
  }
}
