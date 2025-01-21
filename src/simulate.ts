import {
  Pool,
  PoolData,
  SimulateDepositParams,
  SimulateSwapParams,
  SimulateWithdrawParams,
} from '@torch-finance/dex-contract-wrapper';
import { Address } from '@ton/core';
import { PoolSimulator, SimulatorState } from '@torch-finance/simulator';
import { TonClient4 } from '@ton/ton';
import { Allocation } from '@torch-finance/core';
import { TorchAPI } from './api';

interface SimulatorConfig {
  torchAPI: TorchAPI;
  tonClient: TonClient4;
  mode: 'offchain' | 'onchain';
}

export class Simulator {
  private torchApi: TorchAPI;
  private mode: 'offchain' | 'onchain';
  private tonClient: TonClient4;

  constructor(config: SimulatorConfig) {
    this.torchApi = config.torchAPI;
    this.mode = config.mode;
    this.tonClient = config.tonClient;
  }

  setMode(mode: 'offchain' | 'onchain') {
    this.mode = mode;
  }

  private transformPoolData(poolData: PoolData): SimulatorState {
    return {
      initA: poolData.basicData.initA,
      futureA: poolData.basicData.futureA,
      initATime: poolData.basicData.initATime,
      futureATime: poolData.basicData.futureATime,
      feeNumerator: Number(poolData.basicData.feeNumerator),
      adminFeeNumerator: Number(poolData.basicData.adminFeeNumerator),
      adminFees: poolData.reserveData.reserves.map((reserve) => new Allocation(reserve)),
      reserves: poolData.reserveData.reserves.map((reserve) => new Allocation(reserve)),
      lpTotalSupply: poolData.basicData.lpTotalSupply,
      decimals: poolData.basicData.decimals.map((decimal) => new Allocation(decimal)),
    };
  }

  private async getPoolSimulator(poolAddress: Address) {
    const pool = await this.tonClient.open(Pool.createFromAddress(poolAddress));
    const poolData = await pool.getPoolData();
    return PoolSimulator.create(this.transformPoolData(poolData));
  }

  async swap(poolAddress: Address, params: SimulateSwapParams) {
    if (this.mode === 'offchain') {
      return this.torchApi.simulateSwap(poolAddress, params);
    }
    const poolSimulator = await this.getPoolSimulator(poolAddress);
    return poolSimulator.swap(params);
  }

  async deposit(poolAddress: Address, params: SimulateDepositParams) {
    if (this.mode === 'offchain') {
      return this.torchApi.simulateDeposit(poolAddress, params);
    }
    const poolSimulator = await this.getPoolSimulator(poolAddress);
    return poolSimulator.deposit(params);
  }

  async withdraw(poolAddress: Address, params: SimulateWithdrawParams) {
    if (this.mode === 'offchain') {
      return this.torchApi.simulateWithdraw(poolAddress, params);
    }
    const poolSimulator = await this.getPoolSimulator(poolAddress);
    return poolSimulator.withdraw(params);
  }
}
