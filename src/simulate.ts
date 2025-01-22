import { SimulateWithdrawResult, SimulateSwapResult } from '@torch-finance/dex-contract-wrapper';
import { TonClient4 } from '@ton/ton';
import { TorchAPI } from './api';
import { SwapParams } from './types/swap';
import { WithdrawParams } from './types/withdraw';
import { DepositParams } from './types/deposit';
import { SimulatorDepositResult } from '@torch-finance/simulator';
import { PoolRates } from './types/rates';
interface SimulatorConfig {
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

  abstract swap(params: SwapParams, rates?: PoolRates): Promise<SimulateSwapResult[]>;
  abstract deposit(params: DepositParams, rates?: PoolRates): Promise<SimulatorDepositResult[]>;
  abstract withdraw(params: WithdrawParams, rates?: PoolRates): Promise<SimulateWithdrawResult[]>;

  getConfig(): SimulatorConfig {
    return {
      torchAPI: this.torchApi,
      tonClient: this.tonClient,
    };
  }
}

export class OnchainSimulatorAPI extends BaseSimulatorAPI {
  async swap(): Promise<SimulateSwapResult[]> {
    throw new Error('Not implemented');
  }

  async deposit(): Promise<SimulatorDepositResult[]> {
    throw new Error('Not implemented');
  }

  async withdraw(): Promise<SimulateWithdrawResult[]> {
    throw new Error('Not implemented');
  }
}

export class OffchainSimulatorAPI extends BaseSimulatorAPI {
  async swap(params: SwapParams): Promise<SimulateSwapResult[]> {
    return this.torchApi.simulateSwap(params);
  }

  async deposit(params: DepositParams): Promise<SimulatorDepositResult[]> {
    return this.torchApi.simulateDeposit(params);
  }

  async withdraw(params: WithdrawParams): Promise<SimulateWithdrawResult[]> {
    return this.torchApi.simulateWithdraw(params);
  }
}

export class Simulator {
  private simulator: BaseSimulatorAPI;

  constructor(config: SimulatorConfig & { mode: 'offchain' | 'onchain' }) {
    if (config.mode === 'offchain') {
      this.simulator = new OffchainSimulatorAPI(config);
    } else {
      throw new Error('Onchain simulator is not implemented');
    }
  }

  setMode(mode: 'offchain' | 'onchain') {
    const config = this.simulator.getConfig();
    if (mode === 'offchain') {
      this.simulator = new OffchainSimulatorAPI(config);
    } else {
      throw new Error('Onchain simulator is not implemented');
    }
  }

  async swap(params: SwapParams, rates?: PoolRates): Promise<SimulateSwapResult[]> {
    return this.simulator.swap(params, rates);
  }

  async deposit(params: DepositParams, rates?: PoolRates): Promise<SimulatorDepositResult[]> {
    return this.simulator.deposit(params, rates);
  }

  async withdraw(params: WithdrawParams, rates?: PoolRates): Promise<SimulateWithdrawResult[]> {
    return this.simulator.withdraw(params, rates);
  }
}
