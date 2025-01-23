import { Address } from '@ton/core';
import { Asset, SignedRate } from '@torch-finance/core';
import { PoolRawResponse, PoolResponse, PoolResponseSchema } from './types/pool';
import { Hop, HopRaw, HopSchema } from '../types/hop';
import { LpAccountRawResponse, LpAccountResponse, LpAccountResponseSchema } from './types/lp-account';
import axios, { AxiosInstance } from 'axios';
import { AssetRawResponse, AssetResponse, AssetResponseSchema } from './types/asset';
import { SignedRateResponse } from './types/signedRate';
import { SimulatorState } from '@torch-finance/simulator';
import { SimulateWithdrawResult, SimulateDepositResult, SimulateSwapResult } from '@torch-finance/dex-contract-wrapper';
import { SwapParams, SwapParamsSchema } from '../types/swap';
import { DepositParams, DepositParamsSchema } from '../types/deposit';
import { WithdrawParams } from '../types/withdraw';
import { GqlQuery, GraphQLResponse } from './types/graphql';

export type TorchAPIOptions = {
  indexerEndpoint: string;
  oracleEndpoint: string;
};

export class TorchAPI {
  private readonly indexer: AxiosInstance;
  private readonly oracle: AxiosInstance;

  constructor(readonly options: TorchAPIOptions) {
    console.log('options', options);
    this.indexer = axios.create({
      baseURL: options.indexerEndpoint,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.oracle = axios.create({
      baseURL: options.oracleEndpoint,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getPools(): Promise<PoolResponse[]> {
    const { data } = await this.indexer.post<GraphQLResponse<{ pools: PoolRawResponse[] }>>('/graphql', {
      query: GqlQuery.SDK_SYNC_POOLS,
    });
    console.log(
      'data',
      data.data.pools.map((pool) => pool.basePool?.assets.map((asset) => asset.asset.type)),
    );
    return data.data.pools.map((pool) => PoolResponseSchema.parse(pool));
  }

  async getPoolStates(): Promise<SimulatorState[]> {
    const { data } = await this.indexer.post<{ pools: SimulatorState[] }>('/graphql', {
      query: `
          query {
            pools {
              ...PoolResponse
            }
          }
        `,
    });
    console.log('data', data);
    return data.pools;
  }

  async getPoolByAddress(address: Address): Promise<PoolResponse> {
    const { data } = await this.indexer.post<{ pool: PoolRawResponse }>('/graphql', {
      query: `
          query {
            pool(address: "${address.toRawString()}") {
              ...PoolResponse
            }
          }
        `,
    });
    return PoolResponseSchema.parse(data.pool);
  }

  async getExchangableAssets(assetIn?: Asset): Promise<AssetResponse[]> {
    const { data } = await this.indexer.post<{ tokens: AssetRawResponse[] }>('/graphql', {
      query: `
          query {
            assets(assetInId: $assetInId) {
              ...Asset
            }
          }
        `,
      variables: {
        assetInId: assetIn?.ID,
      },
    });
    return data.tokens.map((token) => AssetResponseSchema.parse(token));
  }

  async getActiveLpAccounts(lpProvider: Address): Promise<LpAccountResponse[]> {
    const { data } = await this.indexer.get<{ lpAccounts: LpAccountRawResponse[] }>('/lp-accounts/active', {
      params: {
        lpProvider: lpProvider.toString(),
      },
    });
    return data.lpAccounts.map((data) => LpAccountResponseSchema.parse(data));
  }

  async getSignedRates(poolAddresses: Address[]): Promise<SignedRate> {
    const { data } = await this.oracle.get<SignedRateResponse>('/signed-rates', {
      params: {
        poolAddresses: poolAddresses.map((address) => address.toString()).join(','),
      },
    });
    return SignedRate.fromJSON(data);
  }

  async getHops(assetIn: Asset, assetOut: Asset): Promise<Hop[]> {
    const response = await this.indexer.get<HopRaw[]>('/hops', {
      params: {
        assetIn: assetIn.ID,
        assetOut: assetOut.ID,
      },
    });
    return response.data.map((hop) => HopSchema.parse(hop));
  }

  async simulateSwap(params: SwapParams): Promise<SimulateSwapResult[]> {
    const parsedParams = SwapParamsSchema.parse(params);
    const requestPayload =
      parsedParams.mode === 'ExactIn'
        ? {
            mode: 'ExactIn',
            amountIn: parsedParams.amountIn.toString(),
          }
        : {
            mode: 'ExactOut',
            amountOut: parsedParams.amountOut.toString(),
          };
    const { data } = await this.indexer.post<
      {
        mode: 'ExactIn' | 'ExactOut';
        amountOut?: string;
        amountIn?: string;
        virtualPriceBefore: string;
        virtualPriceAfter: string;
      }[]
    >('/simulate/swap', {
      assetIn: parsedParams.assetIn,
      assetOut: parsedParams.assetOut,
      ...requestPayload,
    });
    return data.map((result) => {
      return params.mode === 'ExactIn'
        ? {
            mode: 'ExactIn',
            amountOut: BigInt(result.amountOut!),
            virtualPriceBefore: BigInt(result.virtualPriceBefore),
            virtualPriceAfter: BigInt(result.virtualPriceAfter),
          }
        : {
            mode: 'ExactOut',
            amountIn: BigInt(result.amountIn!),
            virtualPriceBefore: BigInt(result.virtualPriceBefore),
            virtualPriceAfter: BigInt(result.virtualPriceAfter),
          };
    });
  }

  async simulateDeposit(params: DepositParams): Promise<SimulateDepositResult[]> {
    const parsedParams = DepositParamsSchema.parse(params);
    const { data } = await this.indexer.post<
      {
        lpTokenOut: string;
        virtualPriceBefore: string;
        virtualPriceAfter: string;
        lpTotalSupply: string;
      }[]
    >('/simulate/deposit', {
      pool: parsedParams.pool.toString(),
      depositAmounts: parsedParams.depositAmounts,
      nextDeposit: parsedParams.nextDeposit
        ? {
            pool: parsedParams.nextDeposit.pool.toString(),
            depositAmounts: parsedParams.nextDeposit.depositAmounts
              ? parsedParams.nextDeposit.depositAmounts[0]
              : undefined,
          }
        : undefined,
    });
    return data.map((result) => ({
      lpTokenOut: BigInt(result.lpTokenOut),
      virtualPriceBefore: BigInt(result.virtualPriceBefore),
      virtualPriceAfter: BigInt(result.virtualPriceAfter),
      lpTotalSupply: BigInt(result.lpTotalSupply),
    }));
  }

  async simulateWithdraw(params: WithdrawParams): Promise<SimulateWithdrawResult[]> {
    let withdrawAsset: Asset | undefined;
    if (params.nextWithdraw && params.mode === 'single') {
      withdrawAsset = Asset.jetton(params.nextWithdraw.pool);
    } else if (params.mode === 'single') {
      withdrawAsset = params.withdrawAsset;
    }
    const { data } = await this.indexer.post<
      {
        amountOuts: string[];
        virtualPriceBefore: string;
        virtualPriceAfter: string;
      }[]
    >('/simulate/withdraw', {
      pool: params.pool.toString(),
      removeLpAmount: params.burnLpAmount.toString(),
      mode: params.mode,
      withdrawAsset: withdrawAsset,
      nextWithdraw: params.nextWithdraw
        ? {
            mode: params.nextWithdraw.mode,
            pool: params.nextWithdraw.pool.toString(),
            withdrawAsset: params.nextWithdraw.withdrawAsset,
          }
        : undefined,
    });
    return data.map((result) => ({
      amountOuts: result.amountOuts.map((amountOut) => BigInt(amountOut)),
      virtualPriceBefore: BigInt(result.virtualPriceBefore),
      virtualPriceAfter: BigInt(result.virtualPriceAfter),
    }));
  }
}
