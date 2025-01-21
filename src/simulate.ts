import {
  Pool,
  PoolData,
  SimulateDepositParams,
  SimulateSwapParams,
  SimulateWithdrawParams,
} from '@torch-finance/dex-contract-wrapper';
import { ITorchAPI } from './api';
import { Address } from '@ton/core';
import { PoolSimulator, SimulatorState } from '@torch-finance/simulator';
import { TonClient4 } from '@ton/ton';
import { Allocation } from '@torch-finance/core';

interface SimulatorConfig {
  torchAPI: ITorchAPI;
  tonClient: TonClient4;
  mode: 'offchain' | 'onchain';
}

export class Simulator {
  private torchAPI: ITorchAPI;
  private mode: 'offchain' | 'onchain';
  private tonClient: TonClient4;

  constructor(config: SimulatorConfig) {
    this.torchAPI = config.torchAPI;
    this.mode = config.mode;
    this.tonClient = config.tonClient;
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
      return this.torchAPI.simulateSwap(poolAddress, params);
    }
    const poolSimulator = await this.getPoolSimulator(poolAddress);
    return poolSimulator.swap(params);
  }

  async deposit(poolAddress: Address, params: SimulateDepositParams) {
    if (this.mode === 'offchain') {
      return this.torchAPI.simulateDeposit(poolAddress, params);
    }
    const poolSimulator = await this.getPoolSimulator(poolAddress);
    return poolSimulator.deposit(params);
  }

  async withdraw(poolAddress: Address, params: SimulateWithdrawParams) {
    if (this.mode === 'offchain') {
      return this.torchAPI.simulateWithdraw(poolAddress, params);
    }
    const poolSimulator = await this.getPoolSimulator(poolAddress);
    return poolSimulator.withdraw(params);
  }
}
