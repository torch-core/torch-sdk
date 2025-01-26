// External Libs
import { Address, OpenedContract, SenderArguments } from '@ton/core';
import { TonClient4 } from '@ton/ton';
// Torch Libs
import {
  DepositNext,
  Factory,
  SimulateDepositResult,
  SimulateSwapExactInResult,
  SimulateSwapExactOutResult,
  SimulateSwapResult,
  SimulateWithdrawResult,
  SwapNext,
  WithdrawNext,
} from '@torch-finance/dex-contract-wrapper';
import { Allocation, Asset, normalize, SignedRate } from '@torch-finance/core';

// Internal Types
import { PoolResponse } from '../types/api/pool';
import {
  ExactInParamsSchema,
  SwapParamsSchema,
  SwapParams,
  WithdrawParams,
  WithdrawParamsSchema,
  DepositParams,
  DepositParamsSchema,
} from '../types/sdk';
import { Hop, HopAction, HopSchema } from '../types/common';
import { SimulateSwapResponse, SimulateDepositResponse, SimulateWithdrawResponse } from '../types/simulator';

import { generateQueryId, buildSwapNext, calculateMinAmountOutBySlippage, calculateExecutionPrice } from '../utils';
import { Simulator } from './simulator';
import { TorchAPI } from './api';

export type TorchSDKOptions = {
  apiEndpoint?: string;
  oracleEndpoint?: string;
  tonClient?: TonClient4;
  factoryAddress?: Address;
  simulateMode?: 'offchain';
};

export class TorchSDK {
  public readonly tonClient: TonClient4;
  public readonly api: TorchAPI;
  private readonly factoryContract: Factory;
  private readonly simulator: Simulator;
  private cachedPools: PoolResponse[];

  constructor(readonly options?: TorchSDKOptions) {
    // Fill in the default values (if not provided)
    // TODO: change to mainnet factory address
    const factoryAddress = options?.factoryAddress || Address.parse('EQBO9Xw9w0hJQx4kw3RSKu2LROZbtKg4icITKYp5enCQVGCu');
    const indexerEndpoint = options?.apiEndpoint || 'https://api.torch.finance';
    const oracleEndpoint = options?.oracleEndpoint || 'https://oracle.torch.finance';
    const simulateMode = options?.simulateMode || 'offchain';

    // Intialization
    this.factoryContract = Factory.createFromAddress(factoryAddress);
    this.tonClient =
      options?.tonClient ||
      new TonClient4({
        // TODO: change to mainnet endpoint
        endpoint: 'https://testnet-v4.tonhubapi.com',
      });
    this.api = new TorchAPI({
      apiEndpoint: indexerEndpoint,
      oracleEndpoint,
    });
    this.simulator = new Simulator({
      torchAPI: this.api,
      tonClient: this.tonClient,
      mode: simulateMode,
    });
    this.cachedPools = [];
  }

  private openFactory(blockNumber?: number): OpenedContract<Factory> {
    if (blockNumber) {
      return this.tonClient.openAt(blockNumber, this.factoryContract);
    }
    return this.tonClient.open(this.factoryContract);
  }

  /**
   * Synchronizes the pool information with the latest data from the API
   *
   * @returns Resolves when the synchronization is complete.
   */
  async sync(): Promise<void> {
    this.cachedPools = await this.api.getPools();
  }

  async getSignedRatesGivenPools(pools: PoolResponse[]): Promise<SignedRate | null> {
    const poolNeedRates = pools.filter((pool) => pool.useRates).map((pool) => pool.address);
    if (poolNeedRates.length === 0) {
      return null;
    }
    return await this.api.getSignedRates(poolNeedRates);
  }

  /**
   * Retrieves pool data by addresses.
   *
   * Optimized to minimize redundant operations and avoid unnecessary API calls.
   * If any requested pool is missing from the cache, it synchronizes with the API first.
   *
   * @param addresses Array of `Address` objects to fetch pool data for.
   * @returns A promise that resolves to an array of `PoolResponse` objects.
   */
  private async getPools(addresses: Address[]): Promise<PoolResponse[]> {
    // Use a Set for efficient lookups of cached pool addresses
    const cachedAddressesSet = new Set(this.cachedPools.map((p) => p.address.toString()));

    // Filter out addresses missing in the cache
    const missingAddresses = addresses.filter((address) => !cachedAddressesSet.has(address.toString()));

    // Sync with the API only if there are missing addresses
    if (missingAddresses.length > 0) {
      await this.sync();

      // Update the cachedAddressesSet after syncing
      this.cachedPools.forEach((pool) => cachedAddressesSet.add(pool.address.toString()));
    }

    // Retrieve pool data from the cache
    const poolInfos = addresses.map((address) => {
      const pool = this.cachedPools.find((p) => p.address.equals(address));
      if (!pool) {
        throw new Error(`Pool not found: ${address.toString()}`);
      }
      return pool;
    });

    return poolInfos;
  }

  private resolveHopsByRoutes(routes: PoolResponse[], assetIn: Asset, assetOut: Asset): Hop[] {
    function calHopAction(
      currentPool: PoolResponse,
      currentAssetIn: Asset,
      assetOut: Asset,
      currentPoolLpAsset: Asset,
    ): HopAction {
      if (currentPool.assets.some(({ asset }) => asset.equals(currentAssetIn)) && assetOut.equals(currentPoolLpAsset)) {
        return HopAction.DEPOSIT; // pool asset -> lp asset
      } else if (
        currentPool.assets.some(({ asset }) => asset.equals(currentAssetIn)) &&
        currentPool.assets.some(({ asset }) => asset.equals(assetOut))
      ) {
        return HopAction.SWAP; // pool asset -> pool asset
      } else if (
        currentAssetIn.equals(currentPoolLpAsset) &&
        currentPool.assets.some(({ asset }) => asset.equals(assetOut))
      ) {
        return HopAction.WITHDRAW; // lp asset -> pool asset
      }
      throw new Error('Unable to determine route action');
    }

    let currentAssetIn = assetIn;
    const hops: Hop[] = [];

    const poolAssetsCache = routes.map((pool) => ({
      assets: new Set(pool.assets.map(({ asset }) => asset)),
      lpAsset: Asset.jetton(pool.address),
    }));

    for (let i = 0; i < routes.length; i++) {
      const currentPool = routes[i];
      const currentPoolData = poolAssetsCache[i];
      const currentPoolAssets = [...currentPoolData.assets, currentPoolData.lpAsset];
      const currentPoolLpAsset = currentPoolData.lpAsset;

      if (i < routes.length - 1) {
        const nextPoolData = poolAssetsCache[i + 1];
        const nextPoolAssets = [...nextPoolData.assets, nextPoolData.lpAsset];

        let selectedAssetOut: Asset | null = null;
        for (const asset of currentPoolAssets) {
          if (!asset.equals(currentAssetIn) && nextPoolAssets.some((nextAsset) => nextAsset.equals(asset))) {
            selectedAssetOut = asset;
            break;
          }
        }

        if (!selectedAssetOut) {
          throw new Error('No valid operation found to connect pools');
        }

        const action = calHopAction(currentPool, currentAssetIn, selectedAssetOut, currentPoolLpAsset);

        hops.push(
          HopSchema.parse({
            action: action as HopAction,
            pool: currentPool,
            assetIn: currentAssetIn,
            assetOut: selectedAssetOut,
          }),
        );
        currentAssetIn = selectedAssetOut;
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
   * Calculate minimum output amounts for a swap operation
   *
   * @param params - The swap parameters
   * @param hops - The hops for the swap operation
   * @param poolsRatesPayloads - The pool rates for the swap operation
   * @returns An object containing the exact output amounts and the minimum output amounts
   */
  private async calculateSwapMinAmountOuts(
    params: SwapParams,
    simulateResults?: SimulateSwapResult[],
  ): Promise<{
    amountIn: bigint;
    minAmountOuts: bigint[] | null;
  }> {
    const parsedParams = SwapParamsSchema.parse(params);
    let amountIn = parsedParams.mode === 'ExactIn' ? parsedParams.amountIn : 0n;
    if (parsedParams.mode === 'ExactIn' && !parsedParams.slippageTolerance && !parsedParams.minAmountOut) {
      return {
        amountIn,
        minAmountOuts: null,
      };
    }

    const amountOuts: bigint[] = [];
    const minAmountOuts: bigint[] = [];

    /**
     * Simulate swap to get the exact output amounts
     */
    if (!simulateResults) {
      simulateResults = await this.simulator.swap(params);
    }

    if (simulateResults.length !== parsedParams.routes!.length) {
      throw new Error(
        `Simulate swap result length (${simulateResults.length}) must match hops length (${parsedParams.routes!.length})`,
      );
    }

    // Simulate and get swap output amounts
    for (const [i, simulateResult] of simulateResults.entries()) {
      let amountOut: bigint;

      if (i === 0) {
        if (parsedParams.mode === 'ExactIn') {
          amountIn = parsedParams.amountIn;
        } else {
          if (simulateResult.mode !== 'ExactOut') throw new Error('Simulate swap result mode must be ExactOut');
          amountIn = simulateResult.amountIn;
        }
      }

      if (simulateResult.mode === 'ExactIn') {
        // ExactIn mode => directly use the simulation output amount
        amountOut = simulateResult.amountOut;
      } else {
        // ExactOut mode => every hop's amountOut is the amountIn of the next hop (except the last hop)
        if (parsedParams.mode === 'ExactIn') {
          throw new Error('Mode mismatch: Received ExactOut simulation for ExactIn swap');
        }
        const nextSimulateResult = simulateResults.at(i + 1);
        if (nextSimulateResult?.mode === 'ExactIn') {
          throw new Error('Invalid simulation sequence: ExactIn result after ExactOut');
        }
        amountOut = nextSimulateResult ? nextSimulateResult.amountIn : parsedParams.amountOut;
      }
      amountOuts.push(amountOut);
    }

    if (parsedParams.mode === 'ExactOut' && !parsedParams.slippageTolerance && !parsedParams.minAmountOut) {
      return {
        amountIn,
        minAmountOuts: null,
      };
    }

    /**
     * Calculate minimum output amounts considering slippage
     *
     * If slippageTolerance is provided, we need to calculate the minimum output amount for each hop
     * considering the slippage tolerance
     */
    if (parsedParams.slippageTolerance) {
      for (const amountOut of amountOuts) {
        const minAmountOut = calculateMinAmountOutBySlippage(amountOut, parsedParams.slippageTolerance);
        minAmountOuts.push(minAmountOut);
      }
    }

    /**
     * Calculate minimum output amounts (if minAmountOut is provided)
     *
     * If minAmountOut is provided, we need to simulate the swap with the given minAmountOut as amountOut
     * and get the minimum output amount for each hop
     */
    if (parsedParams.minAmountOut) {
      const simulateResults = await this.simulator.swap({
        mode: 'ExactOut',
        assetIn: parsedParams.assetIn,
        assetOut: parsedParams.assetOut,
        amountOut: parsedParams.minAmountOut, // Assume minAmountOut is the amountOut
      });

      // Validate simulate results length
      if (simulateResults.length !== parsedParams.routes!.length) {
        throw new Error(
          `Simulate swap result length (${simulateResults.length}) must match hops length (${parsedParams.routes!.length})`,
        );
      }

      // Extract minAmountOuts from simulate results
      for (const [i, simulateResult] of simulateResults.entries()) {
        if (simulateResult.mode === 'ExactIn') {
          throw new Error('Invalid simulation sequence: ExactIn result after ExactOut');
        }

        const nextSimulateResult = simulateResults.at(i + 1);
        if (nextSimulateResult && nextSimulateResult.mode === 'ExactIn') {
          throw new Error('Invalid simulation sequence: ExactIn result after ExactOut');
        }

        // minAmountOut is the amountIn of the next hop (except the last hop)
        minAmountOuts.push(nextSimulateResult ? nextSimulateResult.amountIn : parsedParams.minAmountOut);
      }
    }

    // Validate amountOuts
    if (amountOuts.length !== parsedParams.routes!.length) {
      throw new Error(
        `Amount out length (${amountOuts.length}) must be equal to hops length (${parsedParams.routes!.length}) if minAmountOut or slippageTolerance is provided`,
      );
    }

    // Validate minAmountOuts (if minAmountOut or slippageTolerance is provided)
    if (parsedParams.minAmountOut || parsedParams.slippageTolerance) {
      if (minAmountOuts.length !== parsedParams.routes!.length) {
        throw new Error(
          `Min amount out length (${minAmountOuts.length}) must be equal to hops length (${parsedParams.routes!.length}) if minAmountOut or slippageTolerance is provided`,
        );
      }
    }

    if (amountIn === 0n) {
      throw new Error('Amount in must be greater than 0');
    }

    if (!minAmountOuts) throw new Error('Min amount outs not found');
    if (minAmountOuts.length === 0) throw new Error('Min amount outs length must be greater than 0');

    return {
      amountIn,
      minAmountOuts: minAmountOuts.length > 0 ? minAmountOuts : null,
    };
  }
  private async calculateDepositMinAmountOuts(
    params: DepositParams,
    simulateResults?: SimulateDepositResult[],
  ): Promise<{
    minAmountOut: bigint | null;
    nextMinAmountOut: bigint | null;
  }> {
    const parsedParams = DepositParamsSchema.parse(params);

    if (!simulateResults) {
      simulateResults = await this.simulator.deposit(params);
    }

    if (simulateResults.length === 0) throw new Error('Simulate deposit result length must be greater than 0');

    let minAmountOut: bigint | null = null;
    let nextMinAmountOut: bigint | null = null;

    if (parsedParams.slippageTolerance) {
      const simulateResult = simulateResults[0];

      minAmountOut = calculateMinAmountOutBySlippage(simulateResult.lpTokenOut, parsedParams.slippageTolerance);

      if (parsedParams.nextDeposit) {
        const nextSimulateResult = simulateResults.at(1);
        if (!nextSimulateResult) throw new Error('Simulate deposit result length must be 2');

        nextMinAmountOut = calculateMinAmountOutBySlippage(
          nextSimulateResult.lpTokenOut,
          parsedParams.slippageTolerance,
        );
      }
    }

    return { minAmountOut, nextMinAmountOut };
  }
  private async calculateWithdrawMinAmountOuts(
    params: WithdrawParams,
    pools: PoolResponse[],
    withdrawSingleAsset: Asset | undefined,
    simulateResults?: SimulateWithdrawResult[],
  ): Promise<{
    amountOuts: Allocation[];
    nextAmountOuts: Allocation[] | null;
    minAmountOuts: Allocation[] | null;
    nextMinAmountOuts: Allocation[] | null;
  }> {
    const parsedParams = WithdrawParamsSchema.parse(params);

    const pool = pools[0];
    const nextPool = pools.at(1);

    // Get minAmountOuts if slippageTolerance is provided
    let amountOuts: Allocation[] = [];
    let nextAmountOuts: Allocation[] | null = null;
    let minAmountOuts: Allocation[] | null = null;
    let nextMinAmountOuts: Allocation[] | null = null;
    if (!simulateResults) {
      simulateResults = await this.simulator.withdraw(params);
      if (simulateResults.length === 0) throw new Error('Simulate withdraw result length must be 1');
    }
    const simulateResult = simulateResults[0]!;

    if (parsedParams.mode === 'Balanced' && simulateResult.amountOuts.length !== pool.assets.length) {
      throw new Error(`In balanced mode, amount out length must match pool assets length (${pool.assets.length})`);
    }
    if (parsedParams.mode === 'Single' && simulateResult.amountOuts.length !== 1) {
      throw new Error('In single mode, amount out length must be 1');
    }

    // Calculate minAmountOuts based on on mode
    if (parsedParams.mode === 'Balanced') {
      amountOuts = Allocation.createAllocations(
        pool.assets.map(({ asset }, i) => ({
          asset,
          value: simulateResult.amountOuts[i]!,
        })),
      );
      if (parsedParams.slippageTolerance) {
        minAmountOuts = Allocation.createAllocations(
          pool.assets.map(({ asset }, i) => ({
            asset,
            value: calculateMinAmountOutBySlippage(simulateResult.amountOuts[i]!, parsedParams.slippageTolerance!),
          })),
        );
      }
    }
    if (parsedParams.mode === 'Single') {
      amountOuts = Allocation.createAllocations([
        {
          asset: withdrawSingleAsset!,
          value: simulateResult.amountOuts[0]!,
        },
      ]);
      if (parsedParams.slippageTolerance) {
        minAmountOuts = Allocation.createAllocations([
          {
            asset: withdrawSingleAsset!,
            value: calculateMinAmountOutBySlippage(simulateResult.amountOuts[0]!, parsedParams.slippageTolerance!),
          },
        ]);
      }
    }

    if (parsedParams.nextWithdraw && nextPool) {
      const nextLpIndex = pool.assets.findIndex(({ asset }) => asset.jettonMaster?.equals(nextPool!.address));
      if (nextLpIndex === -1) throw new Error('Next pool LP asset not found');
      const nextLpAmount =
        parsedParams.mode === 'Single' ? simulateResult.amountOuts[0] : simulateResult.amountOuts[nextLpIndex];
      if (nextLpAmount === undefined) throw new Error('Next pool LP amount not found');
      if (simulateResults.length < 2) throw new Error('Simulate withdraw result length must be greater than 1');

      const nextSimulateResult = simulateResults[1]!;
      if (
        parsedParams.nextWithdraw.mode === 'Balanced' &&
        nextSimulateResult.amountOuts.length !== nextPool!.assets.length
      ) {
        throw new Error(
          `In balanced mode, amount out length must match pool assets length (${nextPool!.assets.length})`,
        );
      }
      if (parsedParams.nextWithdraw.mode === 'Single' && nextSimulateResult.amountOuts.length !== 1) {
        throw new Error('In single mode, amount out length must be 1');
      }

      // Calculate nextMinAmountOuts based on on mode
      if (parsedParams.nextWithdraw.mode === 'Balanced') {
        nextAmountOuts = Allocation.createAllocations(
          nextPool.assets.map(({ asset }, i) => ({
            asset,
            value: nextSimulateResult.amountOuts[i],
          })),
        );
        if (parsedParams.slippageTolerance) {
          nextMinAmountOuts = Allocation.createAllocations(
            nextPool.assets.map(({ asset }, i) => ({
              asset,
              value: calculateMinAmountOutBySlippage(nextSimulateResult.amountOuts[i], parsedParams.slippageTolerance!),
            })),
          );
        }
      }
      if (parsedParams.nextWithdraw.mode === 'Single') {
        nextAmountOuts = Allocation.createAllocations([
          {
            asset: parsedParams.nextWithdraw.withdrawAsset!,
            value: nextSimulateResult.amountOuts[0],
          },
        ]);
        if (parsedParams.slippageTolerance) {
          nextMinAmountOuts = Allocation.createAllocations([
            {
              asset: parsedParams.nextWithdraw.withdrawAsset!,
              value: calculateMinAmountOutBySlippage(nextSimulateResult.amountOuts[0], parsedParams.slippageTolerance!),
            },
          ]);
        }
      }
    }

    return { amountOuts, nextAmountOuts, minAmountOuts, nextMinAmountOuts };
  }

  private async prepareDepositAllocations(
    params: DepositParams,
    pools: PoolResponse[],
  ): Promise<{
    poolAllocations: Allocation[];
    metaAllocation: Allocation | undefined;
  }> {
    const parsedParams = DepositParamsSchema.parse(params);
    const pool = pools[0];
    const nextPool = pools[1];

    // Normalize allocations
    const poolAllocations: Allocation[] = normalize(
      parsedParams.depositAmounts,
      pool.assets.map(({ asset }) => asset),
    );
    const metaAsset = nextPool?.assets.find(({ asset }) => !asset.jettonMaster?.equals(pool.address));
    const nextDepositAmounts = parsedParams.nextDeposit?.depositAmounts;
    if (metaAsset && nextDepositAmounts && !nextDepositAmounts.at(0)!.asset.equals(metaAsset!.asset)) {
      throw new Error('Wrong meta asset in next deposit');
    }
    const metaAllocation = metaAsset
      ? nextDepositAmounts?.at(0) || new Allocation({ asset: metaAsset.asset, value: BigInt(0) })
      : undefined;

    // Validate next deposit
    if (parsedParams.nextDeposit) {
      if (!nextPool) throw new Error(`Next pool ${parsedParams.nextDeposit?.pool} not found`);
      if (!metaAsset) throw new Error(`Meta asset is missing in next pool ${nextPool.address}`);
      if (!metaAllocation) throw new Error(`Meta allocation is missing in next pool ${nextPool.address}`);
    }

    return { poolAllocations, metaAllocation };
  }
  private prepareWithdrawAsset(
    params: WithdrawParams,
    nextPool: PoolResponse | undefined,
  ): { withdrawAsset: Asset | undefined } {
    const parsedParams = WithdrawParamsSchema.parse(params);

    let withdrawAsset: Asset | undefined =
      parsedParams.mode === 'Single' && !parsedParams.nextWithdraw ? parsedParams.withdrawAsset : undefined;

    // Validate next withdraw requirements
    if (parsedParams.nextWithdraw) {
      if (!nextPool) throw new Error(`Next pool ${parsedParams.nextWithdraw?.pool} not found`);
      // If withdrawAsset is not provided in single mode, use the next pool's LP asset
      if (parsedParams.mode === 'Single') {
        withdrawAsset = nextPool.lpAsset.asset;
      }
    }

    return { withdrawAsset };
  }

  private async buildSwapPayload(
    sender: Address,
    params: SwapParams,
    amountIn: bigint,
    minAmountOuts: bigint[] | null,
    hops: Hop[],
    signedRate: SignedRate | null,
    options?: { blockNumber?: number },
  ): Promise<SenderArguments> {
    const factory = this.openFactory(options?.blockNumber);
    // Parse exact in params
    const parsedExactInParams = ExactInParamsSchema.parse({
      ...params,
      mode: 'ExactIn',
      amountIn,
    });

    const [firstHop, ...restHops] = hops;
    if (!firstHop) throw new Error('No hops found');

    // Handle different actions
    if (firstHop.action === 'Swap') {
      const senderArgs = await factory.getSwapPayload(sender, {
        queryId: parsedExactInParams.queryId || (await generateQueryId()),
        poolAddress: firstHop.pool.address,
        assetIn: firstHop.assetIn,
        assetOut: firstHop.assetOut,
        amountIn: parsedExactInParams.amountIn,
        config: {
          deadline: parsedExactInParams.deadline,
          minAmountOut: minAmountOuts?.at(0),
          recipient: parsedExactInParams.recipient,
          signedRate: signedRate,
          fulfillPayload: parsedExactInParams.fulfillPayload,
          rejectPayload: parsedExactInParams.rejectPayload,
          extraPayload: undefined,
        },
        next: buildSwapNext(restHops, minAmountOuts?.slice(1)) as SwapNext | WithdrawNext,
      });
      return senderArgs;
    }

    if (firstHop.action === 'Deposit') {
      const senderArgs = await factory.getDepositPayload(sender, {
        queryId: parsedExactInParams.queryId || (await generateQueryId()),
        poolAddress: firstHop.pool.address,
        poolAllocations: Allocation.createAllocations(
          firstHop.pool.assets.map(({ asset }) => ({
            asset,
            value: asset.equals(firstHop.assetIn) ? parsedExactInParams.amountIn : BigInt(0),
          })),
        ),
        config: {
          minLpAmount: minAmountOuts?.at(0) ?? null,
          signedRate: signedRate,
          recipient: parsedExactInParams.recipient,
          fulfillPayload: parsedExactInParams.fulfillPayload,
          rejectPayload: parsedExactInParams.rejectPayload,
          extraPayload: undefined,
        },
        next: buildSwapNext(restHops, minAmountOuts?.slice(1)) as SwapNext | DepositNext | null,
      });
      if (senderArgs.length === 0) throw new Error('No sender arguments found');
      return senderArgs[0]!;
    }

    if (firstHop.action === 'Withdraw') {
      return await factory.getWithdrawPayload(sender, {
        queryId: parsedExactInParams.queryId || (await generateQueryId()),
        poolAddress: firstHop.pool.address,
        burnLpAmount: parsedExactInParams.amountIn,
        config: {
          mode: 'Single',
          assetOut: firstHop.assetOut,
          minAmountOut: minAmountOuts?.at(0) ?? null,
        },
        recipient: parsedExactInParams.recipient,
        signedRate: signedRate,
        next: buildSwapNext(restHops, minAmountOuts?.slice(1)) as WithdrawNext | null,
      });
    }

    throw new Error(`Invalid action: ${firstHop.action}`);
  }
  private async buildDepositPayload(
    sender: Address,
    params: DepositParams,
    pools: PoolResponse[],
    poolAllocations: Allocation[],
    metaAllocation: Allocation | undefined,
    minAmountOut: bigint | null,
    nextMinAmountOut: bigint | null,
    signedRate: SignedRate | null,
    options?: { blockNumber?: number; simulateResult?: SimulateDepositResponse },
  ): Promise<SenderArguments[]> {
    const parsedParams = DepositParamsSchema.parse(params);
    const [pool, nextPool] = pools as [PoolResponse, PoolResponse | undefined];
    const factory = this.openFactory(options?.blockNumber);
    const senderArgs = await factory.getDepositPayload(sender, {
      queryId: parsedParams.queryId || (await generateQueryId()),
      poolAddress: pool.address,
      poolAllocations,
      config: {
        signedRate: signedRate,
        minLpAmount: minAmountOut,
        recipient: parsedParams.recipient,
        fulfillPayload: parsedParams.fulfillPayload,
        rejectPayload: parsedParams.rejectPayload,
        extraPayload: parsedParams.extraPayload,
      },
      next: parsedParams.nextDeposit
        ? {
            type: 'Deposit',
            nextPoolAddress: nextPool!.address,
            metaAllocation: metaAllocation!,
            minLpAmount: nextMinAmountOut,
          }
        : null,
    });
    return senderArgs;
  }
  private async buildWithdrawPayload(
    sender: Address,
    params: WithdrawParams,
    pools: PoolResponse[],
    withdrawAsset: Asset | undefined,
    minAmountOuts: Allocation[] | null,
    nextMinAmountOuts: Allocation[] | null,
    signedRate: SignedRate | null,
    options?: { blockNumber?: number },
  ): Promise<SenderArguments> {
    const parsedParams = WithdrawParamsSchema.parse(params);
    const [pool, nextPool] = pools as [PoolResponse, PoolResponse | undefined];
    const factory = this.openFactory(options?.blockNumber);
    const senderArgs = await factory.getWithdrawPayload(sender, {
      queryId: parsedParams.queryId || (await generateQueryId()),
      poolAddress: pool.address,
      burnLpAmount: parsedParams.burnLpAmount,
      signedRate: signedRate,
      recipient: parsedParams.recipient,
      extraPayload: undefined, // TODO: Add extra payload in next release
      config:
        parsedParams.mode === 'Single'
          ? {
              mode: 'Single',
              assetOut: withdrawAsset!, // Must provide withdrawAsset in single mode for contract wrapper, no matter it has next withdraw or not.
              minAmountOut: minAmountOuts?.at(0)?.value,
            }
          : {
              mode: 'Balanced',
              minAmountOuts: minAmountOuts,
            },
      next: parsedParams.nextWithdraw
        ? {
            type: 'Withdraw',
            nextPoolAddress: nextPool!.address,
            config:
              parsedParams.nextWithdraw.mode === 'Single'
                ? {
                    mode: 'Single',
                    assetOut: parsedParams.nextWithdraw.withdrawAsset,
                    minAmountOut: nextMinAmountOuts?.at(0)?.value,
                  }
                : {
                    mode: 'Balanced',
                    minAmountOuts: nextMinAmountOuts,
                  },
          }
        : null,
    });
    return senderArgs;
  }

  private async getSwapRoutes(params: SwapParams): Promise<{ hops: Hop[]; routes: Address[] }> {
    const parsedParams = SwapParamsSchema.parse(params);
    // Get hops
    let hops: Hop[] = [];
    let routes: Address[] = [];
    if (parsedParams.routes && parsedParams.routes.length > 0) {
      const pools = await this.getPools(parsedParams.routes);
      hops = this.resolveHopsByRoutes(pools, parsedParams.assetIn, parsedParams.assetOut);
    } else {
      hops = await this.api.getHops(parsedParams.assetIn, parsedParams.assetOut);
    }
    if (hops.length === 0) throw new Error('No routes found');
    routes = hops.map((hop) => hop.pool.address);
    return { hops, routes };
  }

  /**
   * Generates the payload required to perform a swap operation.
   *
   * This function parses the swap parameters, ensures pool data is synchronized,
   * calculates the minimum amount of assets out if slippage tolerance is provided,
   *
   * @param {Address} sender - The address of the sender initiating the swap.
   * @param {SwapParams} params - The parameters for the swap, including the target pool, amounts, and optional next swap information.
   * @returns {Promise<SenderArguments>} - A promise that resolves to the swap payload, ready to be signed and executed.
   */
  async getSwapPayload(
    sender: Address,
    params: SwapParams,
    options?: { blockNumber?: number },
  ): Promise<SenderArguments> {
    // Get hops
    const { hops, routes } = await this.getSwapRoutes(params);
    params.routes = routes;

    // Get signed rates
    const signedRate = await this.getSignedRatesGivenPools(hops.map((hop) => hop.pool));

    // Get minAmountOuts, amountOuts
    const { amountIn, minAmountOuts } = await this.calculateSwapMinAmountOuts(params);

    // Build swap payload
    return this.buildSwapPayload(sender, params, amountIn, minAmountOuts, hops, signedRate, options);
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
  async getDepositPayload(
    sender: Address,
    params: DepositParams,
    options?: { blockNumber?: number },
  ): Promise<SenderArguments[]> {
    const parsedParams = DepositParamsSchema.parse(params);

    // Get pools
    const pools = await this.getPools(
      [parsedParams.pool, parsedParams.nextDeposit?.pool].filter((pool) => pool !== undefined),
    );

    // Calculate minAmountOut, nextMinAmountOut
    const { minAmountOut, nextMinAmountOut } = await this.calculateDepositMinAmountOuts(params);

    // Get signed rates
    const signedRate = await this.getSignedRatesGivenPools(pools);

    // Prepare pool allocations
    const { poolAllocations, metaAllocation } = await this.prepareDepositAllocations(params, pools);

    // Calculate minAmountOut, nextMinAmountOut for the current pool and the next pool
    return this.buildDepositPayload(
      sender,
      params,
      pools,
      poolAllocations,
      metaAllocation,
      minAmountOut,
      nextMinAmountOut,
      signedRate,
      options,
    );
  }

  /**
   * Generates the payload required to perform a token withdraw operation.
   *
   * This function parses the withdraw parameters, ensures pool data is synchronized,
   * calculates the minimum amount of assets out if slippage tolerance is provided,
   * retrieves necessary pool information, and generates payloads for withdraw execution.
   * WithdrawAsset and nextWithdraw is mutually exclusive in Single Withdraw mode.
   *
   * @param {Address} sender - The address of the sender initiating the withdraw.
   * @param {WithdrawParams} params - The parameters for the withdraw, including the target pool, amounts, and optional next withdraw information.
   * @returns {Promise<SenderArguments[]>} - A promise that resolves to an array of withdraw payloads, ready to be signed and executed.
   */
  async getWithdrawPayload(
    sender: Address,
    params: WithdrawParams,
    options?: { blockNumber?: number },
  ): Promise<SenderArguments> {
    const parsedParams = WithdrawParamsSchema.parse(params);

    const pools = await this.getPools(
      [parsedParams.pool, parsedParams.nextWithdraw?.pool].filter((pool) => pool !== undefined),
    );

    const signedRate = await this.getSignedRatesGivenPools(pools);

    // Prepare withdrawAsset
    const { withdrawAsset } = this.prepareWithdrawAsset(params, pools.at(1));

    // Calculate minAmountOuts
    const { minAmountOuts, nextMinAmountOuts } = await this.calculateWithdrawMinAmountOuts(
      params,
      pools,
      withdrawAsset,
    );

    // Build withdraw payload
    return this.buildWithdrawPayload(
      sender,
      params,
      pools,
      withdrawAsset,
      minAmountOuts,
      nextMinAmountOuts,
      signedRate,
      options,
    );
  }
  /**
   * Simulates a swap operation and returns detailed information about the expected outcome
   *
   * @param params - The swap parameters
   * @returns A promise that resolves to the simulation response containing output amounts and execution details
   * @example
   * ```ts
   * const { result, getSwapPayload } = await torchSDK.simulateSwap({
   *   mode: 'ExactIn',
   *   assetIn: PoolAssets.tsTONAsset,
   *   assetOut: PoolAssets.stTONAsset,
   *   amountIn: toNano('0.05'), // 0.05 tsTON
   * });
   * // Show result
   * console.log(`Estimated amount out: ${result.amountOut}`);
   * console.log(`Min amount out: ${result.minAmountOut}`);
   * console.log(`Execution price: ${result.executionPrice}`);
   * // Send Swap
   * const senderArgs = await getSwapPayload(userWalletAddress, {blockNumber: 123456});
   * await send(senderArgs);
   * ```
   */
  async simulateSwap(params: SwapParams): Promise<{
    result: SimulateSwapResponse;
    getSwapPayload: (address: Address, options?: { blockNumber?: number }) => Promise<SenderArguments>;
  }> {
    const parsedParams = SwapParamsSchema.parse(params);

    // Get hops
    const { hops, routes } = await this.getSwapRoutes(params);
    params.routes = routes;

    // Get inDecimals, outDecimals
    const inDecimals = hops[0].pool.assets.find(({ asset }) => asset.equals(parsedParams.assetIn))?.decimals;
    const outDecimals = hops[hops.length - 1].pool.assets.find(({ asset }) =>
      asset.equals(parsedParams.assetOut),
    )?.decimals;

    if (!inDecimals || !outDecimals) throw new Error('InDecimals or OutDecimals not found');

    // Simulate swap
    const simulateResults = await this.simulator.swap(params);
    if (simulateResults.length !== routes.length) {
      throw new Error(
        `Simulate swap result length must match routes length: ${simulateResults.length} !== ${routes.length}`,
      );
    }

    // Calculate minAmountOuts
    const { amountIn, minAmountOuts } = await this.calculateSwapMinAmountOuts(params, simulateResults);

    if (!simulateResults.every((result) => result.mode === parsedParams.mode))
      throw new Error('Simulate swap result mode must match swap mode');

    // Build swap payload
    const parsedExactInParams = ExactInParamsSchema.parse({
      ...parsedParams,
      mode: 'ExactIn',
      amountIn,
    });

    if (parsedParams.mode === 'ExactIn') {
      const lastDetail = simulateResults[simulateResults.length - 1]!;
      if (lastDetail.mode !== 'ExactIn') throw new Error('Last detail must be ExactIn');
      return {
        result: {
          mode: 'ExactIn',
          routes,
          amountOut: lastDetail.amountOut,
          minAmountOut: minAmountOuts?.at(minAmountOuts.length - 1),
          details: simulateResults as SimulateSwapExactInResult[],
          executionPrice: calculateExecutionPrice(
            { amount: amountIn, decimals: inDecimals },
            { amount: lastDetail.amountOut, decimals: outDecimals },
          ),
        },
        getSwapPayload: async (address: Address, options?: { blockNumber?: number }) => {
          const signedRate = await this.getSignedRatesGivenPools(hops.map((hop) => hop.pool));
          return this.buildSwapPayload(
            address,
            parsedExactInParams,
            amountIn,
            minAmountOuts,
            hops,
            signedRate,
            options,
          );
        },
      };
    } else {
      const lastDetail = simulateResults[simulateResults.length - 1]!;
      if (lastDetail.mode !== 'ExactOut') throw new Error('Last detail must be ExactOut');
      return {
        result: {
          mode: 'ExactOut',
          routes,
          amountIn: amountIn,
          minAmountOut: minAmountOuts?.at(0),
          details: simulateResults as SimulateSwapExactOutResult[],
          executionPrice: calculateExecutionPrice(
            { amount: amountIn, decimals: inDecimals },
            { amount: parsedParams.amountOut, decimals: outDecimals },
          ),
        },
        getSwapPayload: async (address: Address, options?: { blockNumber?: number }) => {
          const signedRate = await this.getSignedRatesGivenPools(hops.map((hop) => hop.pool));
          return this.buildSwapPayload(
            address,
            parsedExactInParams,
            amountIn,
            minAmountOuts,
            hops,
            signedRate,
            options,
          );
        },
      };
    }
  }

  /**
   * Simulates a deposit operation and returns detailed information about the expected outcome
   *
   * @param params - The deposit parameters
   * @returns A promise that resolves to the simulation response containing LP token amounts and execution details
   * @example
   * ```ts
   * const { result, getDepositPayload } = await torchSDK.simulateDeposit({
   *   pool: Address.parse("TriTon Pool Address"),
   *   depositAmounts: [
   *     { asset: Address.parse("tsTON Address"), amount: toNano('0.05') }, // 0.05 tsTON
   *     { asset: Address.parse("stTON Address"), amount: toNano('0.05') }, // 0.05 stTON
   *     { asset: Address.parse("TON Address"), amount: toNano('100') }, // 0.05 TON
   *   ],
   * });
   * // Show result
   * console.log(`Estimated LP token out: ${result.lpTokenOut}`);
   * console.log(`Min LP token out: ${result.minLpTokenOut}`);
   * console.log(`LP total supply after: ${result.lpTotalSupplyAfter}`);
   * // Send Deposit
   * const senderArgs = await getDepositPayload(userWalletAddress, {blockNumber: 123456});
   * await send(senderArgs);
   * ```
   */
  async simulateDeposit(params: DepositParams): Promise<{
    result: SimulateDepositResponse;
    getDepositPayload: (address: Address, options?: { blockNumber?: number }) => Promise<SenderArguments[]>;
  }> {
    const parsedParams = DepositParamsSchema.parse(params);

    // Get pools and rates
    const pools = await this.getPools(
      [parsedParams.pool, parsedParams.nextDeposit?.pool].filter((pool) => pool !== undefined),
    );

    // Simulate the deposit
    const simulateResults = await this.simulator.deposit(params);
    if (simulateResults.length !== pools.length) {
      throw new Error(
        `Simulate deposit result length must match pools length: ${simulateResults.length} !== ${pools.length}`,
      );
    }

    // Build deposit payload
    const lastSimulateResult = simulateResults[simulateResults.length - 1];

    return {
      result: {
        lpTokenOut: lastSimulateResult.lpTokenOut,
        lpTotalSupplyAfter: lastSimulateResult.lpTotalSupply,
        minLpTokenOut: parsedParams.slippageTolerance
          ? calculateMinAmountOutBySlippage(lastSimulateResult.lpTokenOut, parsedParams.slippageTolerance)
          : undefined,
        details: simulateResults,
      },
      getDepositPayload: async (sender: Address, options?: { blockNumber?: number }) => {
        // Get signed rates
        const signedRate = await this.getSignedRatesGivenPools(pools);

        // Prepare pool allocations
        const { poolAllocations, metaAllocation } = await this.prepareDepositAllocations(params, pools);

        // Calculate minAmountOut, nextMinAmountOut
        const { minAmountOut, nextMinAmountOut } = await this.calculateDepositMinAmountOuts(params, simulateResults);

        // Build deposit payload
        return this.buildDepositPayload(
          sender,
          params,
          pools,
          poolAllocations,
          metaAllocation,
          minAmountOut,
          nextMinAmountOut,
          signedRate,
          options,
        );
      },
    };
  }

  /**
   * Simulates a withdraw operation and returns detailed information about the expected outcome
   *
   * @param params - The withdraw parameters
   * @returns A promise that resolves to the simulation response containing output amounts and execution details
   */
  async simulateWithdraw(params: WithdrawParams): Promise<{
    result: SimulateWithdrawResponse;
    getWithdrawPayload: (address: Address, options?: { blockNumber?: number }) => Promise<SenderArguments>;
  }> {
    const parsedParams = WithdrawParamsSchema.parse(params);

    // Get pools and rates
    const pools = await this.getPools(
      [parsedParams.pool, parsedParams.nextWithdraw?.pool].filter((pool) => pool !== undefined),
    );

    // Simulate the withdrawal
    const simulateResults = await this.simulator.withdraw(params);
    if (simulateResults.length !== pools.length) {
      throw new Error(
        `Simulate withdraw result length must match pools length: ${simulateResults.length} !== ${pools.length}`,
      );
    }

    // Prepare withdrawAsset
    const { withdrawAsset } = this.prepareWithdrawAsset(params, pools.at(1));

    // Calculate minAmountOuts
    const { amountOuts, nextAmountOuts, minAmountOuts, nextMinAmountOuts } = await this.calculateWithdrawMinAmountOuts(
      params,
      pools,
      withdrawAsset,
      simulateResults,
    );

    // Build withdraw payload
    return {
      result: {
        amountOuts: amountOuts.concat(nextAmountOuts ?? []),
        minAmountOuts: (minAmountOuts ?? []).concat(nextMinAmountOuts ?? []),
        details: simulateResults,
      },
      getWithdrawPayload: async (address: Address, options?: { blockNumber?: number }) => {
        const signedRate = await this.getSignedRatesGivenPools(pools);
        const { withdrawAsset } = this.prepareWithdrawAsset(params, pools.at(1));

        return this.buildWithdrawPayload(
          address,
          params,
          pools,
          withdrawAsset,
          minAmountOuts,
          nextMinAmountOuts,
          signedRate,
          options,
        );
      },
    };
  }
}
