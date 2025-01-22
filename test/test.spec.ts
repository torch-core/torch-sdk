import { Allocation } from '@torch-finance/core';
import { PoolConfig, PoolAssets, FactoryConfig } from './config';
import { toNano } from '@ton/core';
import { DepositParams } from '../src/types/deposit';
import { TorchSDK } from '../src/index';
import { SwapParams } from '../src/types/swap';

describe('Simulate Testcases', () => {
  let torchSDK: TorchSDK;
  beforeEach(async () => {
    torchSDK = new TorchSDK({
      factoryAddress: FactoryConfig.factoryAddress,
      indexerEndpoint: 'http://localhost:3001',
      oracleEndpoint: 'https://oracle.torch.finance',
    });
  });
  it('should simulate deposit', async () => {
    const depositParams: DepositParams = {
      pool: PoolConfig.triTONPoolAddress,
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
      nextDeposit: {
        pool: PoolConfig.quaTONPoolAddress,
        depositAmounts: new Allocation({
          asset: PoolAssets.hTONAsset,
          value: toNano(1.4),
        }),
      },
    };

    const simulateDepositResultSDK = await torchSDK.simulateDeposit(depositParams);
    console.log(simulateDepositResultSDK);
  });

  // it('should simulate swap', async () => {
  //   const swapParams: SwapParams = {
  //     mode: 'ExactIn',
  //     assetIn: PoolAssets.tonAsset,
  //     assetOut: PoolAssets.tsTONAsset,
  //     amountIn: toNano(0.5),
  //   };
  //   const simulateSwapResult = await torchSDK.simulateSwap(swapParams);
  //   console.log(simulateSwapResult);
  // });
});
