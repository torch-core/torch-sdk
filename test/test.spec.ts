import { Allocation } from '@torch-finance/core';
import { TorchAPI } from '../src/api';
import { PoolConfig, PoolAssets } from './config';
import { toNano } from '@ton/core';

describe('Simulate Testcases', () => {
  let torchAPI: TorchAPI;
  beforeEach(async () => {
    torchAPI = new TorchAPI({
      indexerEndpoint: 'http://localhost:3001',
      oracleEndpoint: 'https://oracle.torch.finance',
    });
  });
  it('should simulate deposit', async () => {
    const simulateDepositResult = await torchAPI.simulateDeposit(PoolConfig.triTONPoolAddress, {
      depositAmounts: Allocation.createAllocations([
        {
          asset: PoolAssets.tonAsset,
          value: toNano(1.1),
        },
        {
          asset: PoolAssets.tsTONAsset,
          value: toNano(1.2),
        },
        {
          asset: PoolAssets.stTONAsset,
          value: toNano(1.3),
        },
      ]),
    });
    console.log(simulateDepositResult);
  });

  it('should simulate swap', async () => {
    const simulateSwapResult = await torchAPI.simulateSwap(PoolConfig.triTONPoolAddress, {
      mode: 'ExactIn',
      assetIn: PoolAssets.tonAsset,
      assetOut: PoolAssets.tsTONAsset,
      amountIn: toNano(0.5),
    });
    console.log(simulateSwapResult);
  });
});
