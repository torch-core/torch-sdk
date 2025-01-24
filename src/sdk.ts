import {
  DepositNext,
  Factory,
  SimulateDepositResult,
  SimulateSwapResult,
  SimulateWithdrawResult,
  SwapNext,
  WithdrawNext,
} from '@torch-finance/dex-contract-wrapper';
import { TorchAPI } from './api';
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
import { PoolRates } from './types/rates';

export type TorchSDKOptions = {
  indexerEndpoint?: string;
  oracleEndpoint?: string;
  client?: TonClient4;
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
    const factoryAddress = options?.factoryAddress || Address.parse('EQBO9Xw9w0hJQx4kw3RSKu2LROZbtKg4icITKYp5enCQVGCu');
    const indexerEndpoint = options?.indexerEndpoint || 'https://api.torch.finance';
    const oracleEndpoint = options?.oracleEndpoint || 'https://oracle.torch.finance';

    // Intialization
    this.tonClient =
      options?.client ||
      new TonClient4({
        endpoint: 'https://testnet-v4.tonhubapi.com',
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
    const missingAddresses = addresses.filter((address) => !this.cachedPools.some((p) => p.address.equals(address)));

    if (missingAddresses.length > 0) {
      await this.sync();
    }

    const poolInfos = addresses.map((address) => {
      const pool = this.cachedPools.find((p) => p.address.equals(address));
      if (!pool) {
        throw new Error(`Pool not found: ${address.toString()}`);
      }
      return pool;
    });

    return poolInfos;
  }

  private getSignedRates = async (
    pools: PoolResponse[],
  ): Promise<{ signedRate: SignedRate | null; poolsRates: PoolRates }> => {
    const poolRates: PoolRates = Array.from({ length: pools.length }, () => null);

    const poolWithRates = pools.filter((pool) => !!pool && pool.useRates).map((pool) => pool!.address);
    if (poolWithRates.length === 0) {
      return { signedRate: null, poolsRates: poolRates };
    }

    const signedRates = await this.api.getSignedRates(poolWithRates);
    for (const [i, pool] of pools.entries()) {
      if (pool.useRates) {
        if (!signedRates) throw new Error('Signed rates not found but pool useRates is true');
        poolRates[i] = signedRates.payload.rates;
      }
    }
    return { signedRate: signedRates, poolsRates: poolRates };
  };

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

    for (const [i, currentPool] of routes.entries()) {
      const currentPoolAssets = [...currentPool.assets.map(({ asset }) => asset), Asset.jetton(currentPool.address)];
      const currentPoolLpAsset = Asset.jetton(currentPool.address);

      if (i < routes.length - 1) {
        const nextPool = routes[i + 1]!;
        const nextPoolAssets = [...nextPool.assets.map(({ asset }) => asset), Asset.jetton(nextPool.address)];

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
   * Calculate minimum output amounts for a swap operation
   *
   * @param params - The swap parameters
   * @param hops - The hops for the swap operation
   * @param poolsRates - The pool rates for the swap operation
   * @returns An object containing the exact output amounts and the minimum output amounts
   */
  private async calculateSwapMinAmountOuts(
    params: SwapParams,
    poolsRates: PoolRates,
  ): Promise<{
    amountIn: bigint;
    minAmountOuts: bigint[] | null;
  }> {
    const parsedParams = SwapParamsSchema.parse(params);

    let amountIn = parsedParams.mode === 'ExactIn' ? parsedParams.amountIn : 0n;

    const amountOuts: bigint[] = [];
    const minAmountOuts: bigint[] = [];

    /**
     * Simulate swap to get the exact output amounts
     */
    const simulateResults = await this.simulator.swap(params, poolsRates);
    console.log('simulateResults in calculateSwapMinAmountOuts', simulateResults);

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
      const simulateResults = await this.simulator.swap(
        {
          mode: 'ExactOut',
          assetIn: parsedParams.assetIn,
          assetOut: parsedParams.assetOut,
          amountOut: parsedParams.minAmountOut, // Assume minAmountOut is the amountOut
        },
        poolsRates,
      );

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

    console.log('minAmountOuts After', minAmountOuts);

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

    return { amountIn, minAmountOuts: minAmountOuts.length > 0 ? minAmountOuts : null };
  }

  private calculateMinAmountOutBySlippage(amountOut: bigint, slippageTolerance: Decimal): bigint {
    const slippageMultiplier = new Decimal(1).minus(slippageTolerance.toNumber());
    const minAmountOut = BigInt(slippageMultiplier.mul(amountOut.toString()).toFixed(0));
    return minAmountOut;
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
    const { signedRate, poolsRates } = await this.getSignedRates(pools);

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
      const simulateResults = await this.simulator.deposit(params, poolsRates);

      if (simulateResults.length === 0) throw new Error('Simulate deposit result length must be 1');
      const simulateResult = simulateResults[0]!;

      console.log('simulateResult', simulateResult);

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
      queryId: params.queryId || 0n,
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

  async getWithdrawPayload(sender: Address, params: WithdrawParams): Promise<SenderArguments> {
    const parsedParams = new Withdraw(params);

    const pools = await this.getPools(
      [parsedParams.pool, parsedParams.nextWithdraw?.pool].filter((pool) => pool !== undefined),
    );
    const [pool, nextPool] = pools as [PoolResponse, PoolResponse | undefined];

    const { signedRate, poolsRates } = await this.getSignedRates(pools);

    // Get minAmountOuts if slippageTolerance is provided
    let minAmountOuts: Allocation[] | null = null;
    let nextMinAmountOuts: Allocation[] | null = null;

    // Validate next withdraw requirements
    if (parsedParams.nextWithdraw) {
      if (!nextPool) throw new Error(`Next pool ${parsedParams.nextWithdraw?.pool} not found`);
      if (parsedParams.mode === 'Single') {
        parsedParams.withdrawAsset = nextPool.lpAsset.asset;
      }
    }

    // Calculate minAmountOuts
    console.log('parsedParams.slippageTolerance', parsedParams.slippageTolerance);
    if (parsedParams.slippageTolerance) {
      const simulateResults = await this.simulator.withdraw(params, poolsRates);
      console.log('simulateResults in slippage', simulateResults);
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
            asset: parsedParams.withdrawAsset!,
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

    console.log('minAmounts after slippage', minAmountOuts);
    console.log('nextMinAmounts after slippage', nextMinAmountOuts);

    const senderArgs = await this.factory.getWithdrawPayload(sender, {
      queryId: params.queryId,
      poolAddress: pool.address,
      burnLpAmount: parsedParams.burnLpAmount,
      signedRate: signedRate,
      recipient: parsedParams.recipient,
      extraPayload: undefined, // TODO: Add extra payload
      config:
        parsedParams.mode === 'Single'
          ? {
              mode: 'Single',
              assetOut: parsedParams.withdrawAsset!,
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
    const { signedRate, poolsRates } = await this.getSignedRates(hops.map((hop) => hop.pool));

    // Get minAmountOuts, amountOuts
    const { amountIn, minAmountOuts } = await this.calculateSwapMinAmountOuts(params, poolsRates);

    // Parse exact in params
    const parsedExactInParams = ExactInParamsSchema.parse({
      ...parsedParams,
      mode: 'ExactIn',
      amountIn,
    });

    // Handle different actions
    if (firstHop.action === 'Swap') {
      const senderArgs = await this.factory.getSwapPayload(sender, {
        queryId: parsedParams.queryId,
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
        queryId: parsedParams.queryId,
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
        queryId: parsedParams.queryId,
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

  async simulateSwap(params: SwapParams): Promise<SimulateSwapResult[]> {
    return await this.simulator.swap(params);
  }

  async simulateDeposit(params: DepositParams): Promise<SimulateDepositResult[]> {
    return await this.simulator.deposit(params);
  }

  async simulateWithdraw(params: WithdrawParams): Promise<SimulateWithdrawResult[]> {
    return await this.simulator.withdraw(params);
  }
}
