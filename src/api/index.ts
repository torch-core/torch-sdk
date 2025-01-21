import { Address } from '@ton/core';
import { Asset, SignedRate } from '@torch-finance/core';
import { PoolRawResponse, PoolResponse, PoolResponseSchema } from './types/pool';
import { Hop, HopRaw, HopSchema } from '../types/hop';
import { LpAccountRawResponse, LpAccountResponse, LpAccountResponseSchema } from './types/lp-account';
import axios, { AxiosInstance } from 'axios';
import { AssetRawResponse, AssetResponse, AssetResponseSchema } from './types/asset';
import { SignedRateResponse } from './types/signedRate';
import { SimulatorState } from '@torch-finance/simulator';

export interface ITorchAPI {
  // Oracle API
  getSignedRates(poolAddresses: Address[]): Promise<SignedRate>;

  // Indexer API
  getExchangableAssets(assetIn?: Asset): Promise<AssetResponse[]>;
  getPools(): Promise<PoolResponse[]>;
  getPoolByAddress(address: Address): Promise<PoolResponse>;
  getHops(assetIn: Asset, assetOut: Asset): Promise<Hop[]>;
  getActiveLpAccounts(lpProvider: Address): Promise<LpAccountResponse[]>;
}

export type TorchAPIOptions = {
  indexerEndpoint: string;
  oracleEndpoint: string;
};

export class TorchAPI implements ITorchAPI {
  private readonly indexer: AxiosInstance;
  private readonly oracle: AxiosInstance;

  constructor(readonly options: TorchAPIOptions) {
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
    const { data } = await this.indexer.post<{ pools: PoolRawResponse[] }>('/graphql', {
      query: `
          query {
            pools {
              ...PoolResponse
            }
          }
        `,
    });
    return data.pools.map((pool) => PoolResponseSchema.parse(pool));
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
        poolAddresses: poolAddresses.map((address) => address.toString()),
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
}
