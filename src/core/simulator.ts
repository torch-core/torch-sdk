import { TonClient4 } from '@ton/ton';
import { SimulateWithdrawResult, SimulateSwapResult, SimulateDepositResult } from '@torch-finance/dex-contract-wrapper';
import { SwapParams, WithdrawParams, DepositParams } from '../types/sdk';
import { TorchAPI } from './api';

export interface SimulatorConfig {
  torchAPI: TorchAPI;
  tonClient: TonClient4;
}

export abstract class BaseSimulatorAPI {
  protected torchApi: TorchAPI;
  protected tonClient: TonClient4;

  constructor(config: SimulatorConfig) {
    this.torchApi = config.torchAPI;
    this.tonClient = config.tonClient;
  }

  abstract swap(params: SwapParams): Promise<SimulateSwapResult[]>;
  abstract deposit(params: DepositParams): Promise<SimulateDepositResult[]>;
  abstract withdraw(params: WithdrawParams): Promise<SimulateWithdrawResult[]>;

  getConfig(): SimulatorConfig {
    return {
      torchAPI: this.torchApi,
      tonClient: this.tonClient,
    };
  }
}

export class OffchainSimulatorAPI extends BaseSimulatorAPI {
  async swap(params: SwapParams): Promise<SimulateSwapResult[]> {
    return this.torchApi.simulateSwap(params);
  }

  async deposit(params: DepositParams): Promise<SimulateDepositResult[]> {
    return this.torchApi.simulateDeposit(params);
  }

  async withdraw(params: WithdrawParams): Promise<SimulateWithdrawResult[]> {
    return this.torchApi.simulateWithdraw(params);
  }
}

export class Simulator {
  private simulator: BaseSimulatorAPI;

  constructor(config: Omit<SimulatorConfig, 'mode'> & { mode?: 'offchain' | 'onchain' }) {
    const mode = config.mode ?? 'offchain'; // Use 'offchain' as default mode
    if (mode === 'offchain') {
      this.simulator = new OffchainSimulatorAPI(config);
    } else {
      throw new Error('Onchain simulator is not implemented');
    }
  }

  async swap(params: SwapParams): Promise<SimulateSwapResult[]> {
    return this.simulator.swap(params);
  }

  async deposit(params: DepositParams): Promise<SimulateDepositResult[]> {
    return this.simulator.deposit(params);
  }

  async withdraw(params: WithdrawParams): Promise<SimulateWithdrawResult[]> {
    return this.simulator.withdraw(params);
  }
}
