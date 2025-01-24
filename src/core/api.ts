// External Libs
import axios, { AxiosInstance } from 'axios';
import { Address } from '@ton/core';
// Torch Libs
import { Asset, SignedRate } from '@torch-finance/core';
import { SimulatorState } from '@torch-finance/simulator';
import { SimulateWithdrawResult, SimulateDepositResult, SimulateSwapResult } from '@torch-finance/dex-contract-wrapper';
// Internal Types
import { Hop, HopRaw, HopSchema } from '../types/common';
import {
  SwapParams,
  SwapParamsSchema,
  DepositParams,
  DepositParamsSchema,
  WithdrawParams,
  WithdrawParamsSchema,
} from '../types/sdk';
import {
  // Asset
  AssetRawResponse,
  AssetResponse,
  AssetResponseSchema,
  // Pool
  PoolRawResponse,
  PoolResponse,
  PoolResponseSchema,
  // Lp Account
  LpAccountRawResponse,
  LpAccountResponse,
  LpAccountResponseSchema,
  // GraphQL
  GqlQuery,
  GraphQLResponse,
} from '../types/api';

export type TorchAPIOptions = {
  apiEndpoint: string;
  oracleEndpoint: string;
};

export class TorchAPI {
  private readonly api: AxiosInstance;
  private readonly oracle: AxiosInstance;

  constructor(readonly options: TorchAPIOptions) {
    this.api = axios.create({
      baseURL: options.apiEndpoint,
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
    const { data } = await this.api.post<GraphQLResponse<{ pools: PoolRawResponse[] }>>('/graphql', {
      query: GqlQuery.SDK_SYNC_POOLS,
    });
    return data.data.pools.map((pool) => PoolResponseSchema.parse(pool));
  }

  async getPoolStates(): Promise<SimulatorState[]> {
    const { data } = await this.api.post<{ pools: SimulatorState[] }>('/graphql', {
      query: `
          query {
            pools {
              ...PoolResponse
            }
          }
        `,
    });
    return data.pools;
  }

  async getExchangableAssets(assetIn?: Asset): Promise<AssetResponse[]> {
    const { data } = await this.api.post<{ tokens: AssetRawResponse[] }>('/graphql', {
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
    const { data } = await this.api.get<{ lpAccounts: LpAccountRawResponse[] }>('/lp-accounts/active', {
      params: {
        lpProvider: lpProvider.toString(),
      },
    });
    return data.lpAccounts.map((data) => LpAccountResponseSchema.parse(data));
  }

  async getSignedRates(poolAddresses: Address[]): Promise<SignedRate> {
    const { data } = await this.oracle.get('/signed-rates', {
      params: {
        poolAddresses: poolAddresses.map((address) => address.toString()).join(','),
      },
    });
    return SignedRate.fromJSON(data);
  }

  async getHops(assetIn: Asset, assetOut: Asset): Promise<Hop[]> {
    const response = await this.api.get<HopRaw[]>('/hops', {
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
    const { data } = await this.api.post<
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
    const { data } = await this.api.post<
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
    const parsedParams = WithdrawParamsSchema.parse(params);
    let withdrawAsset: Asset | undefined;
    if (parsedParams.mode === 'Single' && parsedParams.nextWithdraw) {
      withdrawAsset = Asset.jetton(parsedParams.nextWithdraw.pool);
    } else if (parsedParams.mode === 'Single') {
      withdrawAsset = parsedParams.withdrawAsset;
    }
    const { data } = await this.api.post<
      {
        amountOuts: string[];
        virtualPriceBefore: string;
        virtualPriceAfter: string;
      }[]
    >('/simulate/withdraw', {
      pool: parsedParams.pool.toString(),
      removeLpAmount: parsedParams.burnLpAmount.toString(),
      mode: parsedParams.mode,
      withdrawAsset: withdrawAsset,
      nextWithdraw: parsedParams.nextWithdraw
        ? {
            mode: parsedParams.nextWithdraw.mode,
            pool: parsedParams.nextWithdraw.pool.toString(),
            ...(parsedParams.nextWithdraw.mode === 'Single' && {
              withdrawAsset: parsedParams.nextWithdraw.withdrawAsset,
            }),
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
