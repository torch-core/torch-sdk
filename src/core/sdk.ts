// External Libs
import { Address, OpenedContract, SenderArguments } from '@ton/core';
import { TonClient4 } from '@ton/ton';
import Decimal from 'decimal.js';
// Torch Libs
import {
  DepositNext,
  Factory,
  SimulateSwapExactInResult,
  SimulateSwapExactOutResult,
  SimulateSwapResult,
  SwapNext,
  WithdrawNext,
} from '@torch-finance/dex-contract-wrapper';
import { Allocation, Asset, normalize } from '@torch-finance/core';
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

import { generateQueryId, buildSwapNext } from '../utils';
import { Simulator } from './simulator';
import { TorchAPI } from './api';

export type TorchSDKOptions = {
  apiEndpoint?: string;
  oracleEndpoint?: string;
  tonClient?: TonClient4;
  factoryAddress?: Address;
};

export class TorchSDK {
  public readonly tonClient: TonClient4;
  public readonly api: TorchAPI;
  private readonly factory: OpenedContract<Factory>;
  private readonly simulator: Simulator;
  private cachedPools: PoolResponse[];

  constructor(readonly options?: TorchSDKOptions) {
    // Fill in the default values (if not provided)
    // TODO: change to mainnet factory address
    const factoryAddress = options?.factoryAddress || Address.parse('EQBO9Xw9w0hJQx4kw3RSKu2LROZbtKg4icITKYp5enCQVGCu');
    const indexerEndpoint = options?.apiEndpoint || 'https://api.torch.finance';
    const oracleEndpoint = options?.oracleEndpoint || 'https://oracle.torch.finance';

    // Intialization
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

  private _resolveHopsByRoutes(routes: PoolResponse[], assetIn: Asset, assetOut: Asset): Hop[] {
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
  private async calculateSwapMinAmountOuts(params: SwapParams): Promise<{
    amountIn: bigint;
    amountOuts: bigint[];
    minAmountOuts: bigint[] | null;
    rawSimulateResults: SimulateSwapResult[];
  }> {
    const parsedParams = SwapParamsSchema.parse(params);
    let amountIn = parsedParams.mode === 'ExactIn' ? parsedParams.amountIn : 0n;

    const amountOuts: bigint[] = [];
    const minAmountOuts: bigint[] = [];

    /**
     * Simulate swap to get the exact output amounts
     */
    const simulateResults = await this.simulator.swap(params);

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

    /**
     * Calculate minimum output amounts considering slippage
     *
     * If slippageTolerance is provided, we need to calculate the minimum output amount for each hop
     * considering the slippage tolerance
     */
    if (parsedParams.slippageTolerance) {
      for (const amountOut of amountOuts) {
        const minAmountOut = this.calculateMinAmountOutBySlippage(amountOut, parsedParams.slippageTolerance);
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

    return {
      amountIn,
      amountOuts,
      minAmountOuts: minAmountOuts.length > 0 ? minAmountOuts : null,
      rawSimulateResults: simulateResults,
    };
  }

  private calculateMinAmountOutBySlippage(amountOut: bigint, slippageTolerance: Decimal): bigint {
    const slippageMultiplier = new Decimal(1).minus(slippageTolerance.toNumber());
    const minAmountOut = BigInt(slippageMultiplier.mul(amountOut.toString()).toFixed(0));
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
  private calculateExecutionPrice(
    tokenIn: { amount: bigint; decimals: number },
    tokenOut: { amount: bigint; decimals: number },
  ): string {
    // Convert amounts to decimal for precise calculation
    const amountInDecimal = new Decimal(tokenIn.amount.toString()).div(10 ** tokenIn.decimals);
    const amountOutDecimal = new Decimal(tokenOut.amount.toString()).div(10 ** tokenOut.decimals);

    // Calculate price as amountIn/amountOut
    return amountInDecimal.div(amountOutDecimal).toFixed(9);
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
  async getDepositPayload(sender: Address, params: DepositParams): Promise<SenderArguments[]> {
    const parsedParams = DepositParamsSchema.parse(params);

    const pools = await this.getPools(
      [parsedParams.pool, parsedParams.nextDeposit?.pool].filter((pool) => pool !== undefined),
    );
    const [pool, nextPool] = pools as [PoolResponse, PoolResponse | undefined];
    const signedRate = await this.api.getSignedRates(pools.map((pool) => pool.address));

    // Normalize allocations and meta allocation
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

    // Calculate minAmountOut, nextMinAmountOut for the current pool and the next pool
    let minAmountOut: bigint | null = null;
    let nextMinAmountOut: bigint | null = null;
    if (parsedParams.slippageTolerance) {
      const simulateResults = await this.simulator.deposit(params);

      if (simulateResults.length === 0) throw new Error('Simulate deposit result length must be 1');
      const simulateResult = simulateResults[0]!;

      minAmountOut = BigInt(
        new Decimal(1 - parsedParams.slippageTolerance.toNumber()).mul(simulateResult.lpTokenOut.toString()).toFixed(0),
      );

      if (parsedParams.nextDeposit) {
        const nextSimulateResult = simulateResults[1];
        if (!nextSimulateResult) throw new Error('Simulate deposit result length must be 2');

        nextMinAmountOut = BigInt(
          new Decimal(1 - parsedParams.slippageTolerance.toNumber())
            .mul(nextSimulateResult.lpTokenOut.toString())
            .toFixed(0),
        );
      }
    }

    const senderArgs = await this.factory.getDepositPayload(sender, {
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
  async getWithdrawPayload(sender: Address, params: WithdrawParams): Promise<SenderArguments> {
    const parsedParams = WithdrawParamsSchema.parse(params);

    const pools = await this.getPools(
      [parsedParams.pool, parsedParams.nextWithdraw?.pool].filter((pool) => pool !== undefined),
    );
    const [pool, nextPool] = pools as [PoolResponse, PoolResponse | undefined];

    const signedRate = await this.api.getSignedRates(pools.map((pool) => pool.address));

    // Get minAmountOuts if slippageTolerance is provided
    let minAmountOuts: Allocation[] | null = null;
    let nextMinAmountOuts: Allocation[] | null = null;
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

    // Calculate minAmountOuts
    if (parsedParams.slippageTolerance) {
      const simulateResults = await this.simulator.withdraw(params);
      if (simulateResults.length === 0) throw new Error('Simulate withdraw result length must be 1');
      const simulateResult = simulateResults[0]!;

      if (parsedParams.mode === 'Balanced' && simulateResult.amountOuts.length !== pool.assets.length) {
        throw new Error(`In balanced mode, amount out length must match pool assets length (${pool.assets.length})`);
      }
      if (parsedParams.mode === 'Single' && simulateResult.amountOuts.length !== 1) {
        throw new Error('In single mode, amount out length must be 1');
      }

      // Calculate minAmountOuts based on on mode
      if (parsedParams.mode === 'Balanced') {
        minAmountOuts = Allocation.createAllocations(
          pool.assets.map(({ asset }, i) => ({
            asset,
            value: this.calculateMinAmountOutBySlippage(simulateResult.amountOuts[i]!, parsedParams.slippageTolerance!),
          })),
        );
      }
      if (parsedParams.mode === 'Single') {
        minAmountOuts = Allocation.createAllocations([
          {
            asset: withdrawAsset!,
            value: this.calculateMinAmountOutBySlippage(simulateResult.amountOuts[0]!, parsedParams.slippageTolerance!),
          },
        ]);
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
          nextMinAmountOuts = Allocation.createAllocations(
            nextPool.assets.map(({ asset }, i) => ({
              asset,
              value: this.calculateMinAmountOutBySlippage(
                nextSimulateResult.amountOuts[i],
                parsedParams.slippageTolerance!,
              ),
            })),
          );
        }
        if (parsedParams.nextWithdraw.mode === 'Single') {
          nextMinAmountOuts = Allocation.createAllocations([
            {
              asset: parsedParams.nextWithdraw.withdrawAsset!,
              value: this.calculateMinAmountOutBySlippage(
                nextSimulateResult.amountOuts[0],
                parsedParams.slippageTolerance!,
              ),
            },
          ]);
        }
      }
    }

    const senderArgs = await this.factory.getWithdrawPayload(sender, {
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
  async getSwapPayload(sender: Address, params: SwapParams): Promise<SenderArguments> {
    const parsedParams = SwapParamsSchema.parse(params);
    // Get hops
    let hops: Hop[] = [];
    if (parsedParams.routes && parsedParams.routes.length > 0) {
      const pools = await this.getPools(parsedParams.routes);
      hops = this._resolveHopsByRoutes(pools, parsedParams.assetIn, parsedParams.assetOut);
    } else {
      hops = await this.api.getHops(parsedParams.assetIn, parsedParams.assetOut);
      params.routes = hops.map((hop) => hop.pool.address);
      parsedParams.routes = hops.map((hop) => hop.pool.address);
    }

    const [firstHop, ...restHops] = hops;
    if (!firstHop) throw new Error('No hops found');

    // Get signed rates
    const signedRate = await this.api.getSignedRates(hops.map((hop) => hop.pool.address));

    // Get minAmountOuts, amountOuts
    const { amountIn, minAmountOuts } = await this.calculateSwapMinAmountOuts(params);

    // Parse exact in params
    const parsedExactInParams = ExactInParamsSchema.parse({
      ...parsedParams,
      mode: 'ExactIn',
      amountIn,
    });

    // Handle different actions
    if (firstHop.action === 'Swap') {
      const senderArgs = await this.factory.getSwapPayload(sender, {
        queryId: parsedParams.queryId || (await generateQueryId()),
        poolAddress: firstHop.pool.address,
        assetIn: firstHop.assetIn,
        assetOut: firstHop.assetOut,
        amountIn: parsedExactInParams.amountIn,
        config: {
          deadline: parsedParams.deadline,
          minAmountOut: minAmountOuts?.at(0),
          recipient: parsedParams.recipient,
          signedRate: signedRate,
          fulfillPayload: parsedParams.fulfillPayload,
          rejectPayload: parsedParams.rejectPayload,
          extraPayload: undefined,
        },
        next: buildSwapNext(restHops, minAmountOuts?.slice(1)) as SwapNext | WithdrawNext,
      });
      return senderArgs;
    }

    if (firstHop.action === 'Deposit') {
      const senderArgs = await this.factory.getDepositPayload(sender, {
        queryId: parsedParams.queryId || (await generateQueryId()),
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
          recipient: parsedParams.recipient,
          fulfillPayload: parsedParams.fulfillPayload,
          rejectPayload: parsedParams.rejectPayload,
          extraPayload: undefined,
        },
        next: buildSwapNext(restHops, minAmountOuts?.slice(1)) as SwapNext | DepositNext | null,
      });
      if (senderArgs.length === 0) throw new Error('No sender arguments found');
      return senderArgs[0]!;
    }

    if (firstHop.action === 'Withdraw') {
      return await this.factory.getWithdrawPayload(sender, {
        queryId: parsedParams.queryId || (await generateQueryId()),
        poolAddress: firstHop.pool.address,
        burnLpAmount: parsedExactInParams.amountIn,
        config: {
          mode: 'Single',
          assetOut: firstHop.assetOut,
          minAmountOut: minAmountOuts?.at(0) ?? null,
        },
        recipient: parsedParams.recipient,
        signedRate: signedRate,
        next: buildSwapNext(restHops, minAmountOuts?.slice(1)) as WithdrawNext | null,
      });
    }

    throw new Error(`Invalid action: ${firstHop.action}`);
  }

  /**
   * Simulates a swap operation and returns detailed information about the expected outcome
   *
   * @param params - The swap parameters
   * @returns A promise that resolves to the simulation response containing output amounts and execution details
   */
  async simulateSwap(params: SwapParams): Promise<SimulateSwapResponse> {
    const parsedParams = SwapParamsSchema.parse(params);

    // Get hops
    let hops: Hop[] = [];
    if (parsedParams.routes && parsedParams.routes.length > 0) {
      const pools = await this.getPools(parsedParams.routes);
      hops = this._resolveHopsByRoutes(pools, parsedParams.assetIn, parsedParams.assetOut);
    } else {
      hops = await this.api.getHops(parsedParams.assetIn, parsedParams.assetOut);
      params.routes = hops.map((hop) => hop.pool.address);
      parsedParams.routes = hops.map((hop) => hop.pool.address);
    }

    // Get inDecimals, outDecimals
    const inDecimals = hops[0].pool.assets.find(({ asset }) => asset.equals(parsedParams.assetIn))?.decimals;
    const outDecimals = hops[hops.length - 1].pool.assets.find(({ asset }) =>
      asset.equals(parsedParams.assetOut),
    )?.decimals;

    if (!inDecimals || !outDecimals) throw new Error('InDecimals or OutDecimals not found');

    // Calculate minAmountOuts
    const { amountIn, amountOuts, minAmountOuts, rawSimulateResults } = await this.calculateSwapMinAmountOuts(params);

    if (!rawSimulateResults.every((result) => result.mode === parsedParams.mode))
      throw new Error('Simulate swap result mode must match swap mode');

    if (parsedParams.mode === 'ExactIn') {
      const lastDetail = rawSimulateResults[rawSimulateResults.length - 1]!;
      if (lastDetail.mode !== 'ExactIn') throw new Error('Last detail must be ExactIn');
      return {
        mode: 'ExactIn',
        amountOut: amountOuts[0],
        minAmountOut: minAmountOuts?.at(0),
        details: rawSimulateResults as SimulateSwapExactInResult[],
        executionPrice: this.calculateExecutionPrice(
          { amount: amountIn, decimals: inDecimals },
          { amount: amountOuts[0], decimals: outDecimals },
        ),
      };
    } else {
      const lastDetail = rawSimulateResults[rawSimulateResults.length - 1]!;
      if (lastDetail.mode !== 'ExactOut') throw new Error('Last detail must be ExactOut');
      return {
        mode: 'ExactOut',
        amountIn: amountIn,
        minAmountOut: minAmountOuts?.at(0),
        details: rawSimulateResults as SimulateSwapExactOutResult[],
        executionPrice: this.calculateExecutionPrice(
          { amount: amountIn, decimals: inDecimals },
          { amount: parsedParams.amountOut, decimals: outDecimals },
        ),
      };
    }
  }

  /**
   * Simulates a deposit operation and returns detailed information about the expected outcome
   *
   * @param params - The deposit parameters
   * @returns A promise that resolves to the simulation response containing LP token amounts and execution details
   */
  async simulateDeposit(params: DepositParams): Promise<SimulateDepositResponse> {
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

    const lastSimulateResult = simulateResults[simulateResults.length - 1]!;

    return {
      lpTokenOut: lastSimulateResult.lpTokenOut,
      lpTotalSupplyAfter: lastSimulateResult.lpTotalSupply,
      minLpTokenOut: parsedParams.slippageTolerance
        ? this.calculateMinAmountOutBySlippage(lastSimulateResult.lpTokenOut, parsedParams.slippageTolerance)
        : undefined,
      details: simulateResults,
    };
  }

  /**
   * Simulates a withdraw operation and returns detailed information about the expected outcome
   *
   * @param params - The withdraw parameters
   * @returns A promise that resolves to the simulation response containing output amounts and execution details
   */
  async simulateWithdraw(params: WithdrawParams): Promise<SimulateWithdrawResponse> {
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

    const [withdrawResult, nextWithdrawResult] = simulateResults;
    const [pool, nextPool] = pools;

    // Collect all amountOuts from all simulation results
    let amountOuts: Allocation[] = [];
    let minAmountOuts: Allocation[] | undefined;

    // First withdraw
    if (parsedParams.mode === 'Balanced') {
      amountOuts = amountOuts.concat(
        withdrawResult.amountOuts
          .map((amountOut, i) => {
            // If next withdraw is provided, skip base lp asset (nextPool.lpAsset)
            if (parsedParams.nextWithdraw && pool.assets[i].asset.equals(nextPool.lpAsset.asset)) return;
            return new Allocation({
              asset: pool.assets[i].asset,
              value: amountOut,
            });
          })
          .filter((allocation): allocation is Allocation => allocation !== undefined),
      );
    } else {
      if (withdrawResult.amountOuts.length !== 1) throw new Error('First withdraw result must have 1 amount out');
      // If next withdraw is provided, skip
      if (!parsedParams.nextWithdraw) {
        amountOuts.push(new Allocation({ asset: parsedParams.withdrawAsset, value: withdrawResult.amountOuts[0] }));
      }
    }

    // Next withdraw
    if (parsedParams.nextWithdraw) {
      if (parsedParams.nextWithdraw.mode === 'Balanced') {
        amountOuts = amountOuts.concat(
          nextWithdrawResult.amountOuts.map(
            (amountOut, i) =>
              new Allocation({
                asset: nextPool.assets[i].asset,
                value: amountOut,
              }),
          ),
        );
      } else {
        if (nextWithdrawResult.amountOuts.length !== 1) throw new Error('Next withdraw result must have 1 amount out');
        amountOuts.push(
          new Allocation({ asset: parsedParams.nextWithdraw.withdrawAsset!, value: nextWithdrawResult.amountOuts[0] }),
        );
      }
    }

    // Calculate minAmountOuts if slippage tolerance is provided
    if (parsedParams.slippageTolerance) {
      minAmountOuts = Allocation.createAllocations(
        amountOuts.map((allocation) => ({
          asset: allocation.asset,
          value: this.calculateMinAmountOutBySlippage(allocation.value, parsedParams.slippageTolerance!),
        })),
      );
    }

    return {
      amountOuts,
      minAmountOuts,
      details: simulateResults,
    };
  }
}
