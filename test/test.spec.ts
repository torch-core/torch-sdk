// import { TorchSDK, WithdrawParams } from '../src';
// import { FactoryConfig, PoolAssets, PoolConfig } from './config';

describe('Simulate Testcases', () => {
  // let torchSDK: TorchSDK;
  // beforeEach(async () => {
  //   torchSDK = new TorchSDK({
  //     factoryAddress: FactoryConfig.factoryAddress,
  //     indexerEndpoint: 'http://localhost:3001',
  //     oracleEndpoint: 'https://oracle.torch.finance',
  //   });
  // });
  it('Hello world', async () => {
    console.log('Hello world');
  });

  // describe('Deposit', () => {
  //   it('should simulate deposit all in TriTON Pool', async () => {
  //     const depositParams: DepositParams = {
  //       pool: PoolConfig.triTONPoolAddress,
  //       depositAmounts: Allocation.createAllocations([
  //         {
  //           asset: PoolAssets.tonAsset,
  //           value: toNano(1.1),
  //         },
  //         {
  //           asset: PoolAssets.tsTONAsset,
  //           value: toNano(1.2),
  //         },
  //         {
  //           asset: PoolAssets.stTONAsset,
  //           value: toNano(1.3),
  //         },
  //       ]),
  //     };
  //     const simulateDepositResult = await torchSDK.simulateDeposit(depositParams);
  //     console.log(simulateDepositResult);
  //   });

  //   it('should simulate deposit TON and stTON in TriTON Pool', async () => {
  //     const depositParams: DepositParams = {
  //       pool: PoolConfig.triTONPoolAddress,
  //       depositAmounts: Allocation.createAllocations([
  //         {
  //           asset: PoolAssets.tonAsset,
  //           value: toNano(1.1),
  //         },
  //         {
  //           asset: PoolAssets.stTONAsset,
  //           value: toNano(1.3),
  //         },
  //       ]),
  //     };
  //     const simulateDepositResult = await torchSDK.simulateDeposit(depositParams);
  //     console.log(simulateDepositResult);
  //   });

  //   it('should simulate deposit TON in TriTON Pool', async () => {
  //     const depositParams: DepositParams = {
  //       pool: PoolConfig.triTONPoolAddress,
  //       depositAmounts: Allocation.createAllocations([
  //         {
  //           asset: PoolAssets.tonAsset,
  //           value: toNano(1.1),
  //         },
  //       ]),
  //     };
  //     const simulateDepositResult = await torchSDK.simulateDeposit(depositParams);
  //     console.log(simulateDepositResult);
  //   });

  //   it('should simulate deposit and deposit with meta asset', async () => {
  //     const depositParams: DepositParams = {
  //       pool: PoolConfig.triTONPoolAddress,
  //       depositAmounts: Allocation.createAllocations([
  //         {
  //           asset: PoolAssets.tonAsset,
  //           value: toNano(1.1),
  //         },
  //         {
  //           asset: PoolAssets.tsTONAsset,
  //           value: toNano(1.2),
  //         },
  //         {
  //           asset: PoolAssets.stTONAsset,
  //           value: toNano(1.3),
  //         },
  //       ]),
  //       nextDeposit: {
  //         pool: PoolConfig.quaTONPoolAddress,
  //         depositAmounts: new Allocation({
  //           asset: PoolAssets.hTONAsset,
  //           value: toNano(1.4),
  //         }),
  //       },
  //     };

  //     const simulateDepositResultSDK = await torchSDK.simulateDeposit(depositParams);
  //     console.log(simulateDepositResultSDK);
  //   });

  //   it('should simulate deposit and deposit without meta asset', async () => {
  //     const depositParams: DepositParams = {
  //       pool: PoolConfig.triTONPoolAddress,
  //       depositAmounts: Allocation.createAllocations([
  //         {
  //           asset: PoolAssets.tonAsset,
  //           value: toNano(1.1),
  //         },
  //         {
  //           asset: PoolAssets.tsTONAsset,
  //           value: toNano(1.2),
  //         },
  //         {
  //           asset: PoolAssets.stTONAsset,
  //           value: toNano(1.3),
  //         },
  //       ]),
  //       nextDeposit: {
  //         pool: PoolConfig.quaTONPoolAddress,
  //       },
  //     };

  //     const simulateDepositResultSDK = await torchSDK.simulateDeposit(depositParams);
  //     console.log(simulateDepositResultSDK);
  //   });
  // });

  // describe('Swap', () => {
  //   it('should simulate swap in one pool', async () => {
  //     // Exact In
  //     const initAmountIn = toNano(0.5);
  //     const swapExactInParams: SwapParams = {
  //       mode: 'ExactIn',
  //       assetIn: PoolAssets.tonAsset,
  //       assetOut: PoolAssets.tsTONAsset,
  //       amountIn: initAmountIn,
  //     };
  //     const simulateSwapExactInResult = await torchSDK.simulateSwap(swapExactInParams);
  //     console.log(simulateSwapExactInResult);
  //     // Exact Out
  //     if (simulateSwapExactInResult[0].mode != 'ExactIn') {
  //       throw new Error('Swap mode is not ExactIn');
  //     }
  //     const swapExactOutParams: SwapParams = {
  //       mode: 'ExactOut',
  //       assetIn: PoolAssets.tonAsset,
  //       assetOut: PoolAssets.tsTONAsset,
  //       amountOut: simulateSwapExactInResult[0].amountOut,
  //     };
  //     const simulateSwapExactOutResult = await torchSDK.simulateSwap(swapExactOutParams);
  //     console.log('simulateSwapExactOutResult', simulateSwapExactOutResult);
  //     if (simulateSwapExactOutResult[0].mode != 'ExactOut') {
  //       throw new Error('Swap mode is not ExactOut');
  //     }
  //     const finalAmountIn = simulateSwapExactOutResult[0].amountIn;
  //     const difference = abs(finalAmountIn, initAmountIn);
  //     expect(difference < toNano(0.01)).toBeTruthy();
  //   });
  //   it('should simulate swap and withdraw single', async () => {
  //     // Exact In
  //     const initAmountIn = toNano(0.05);
  //     const swapExactInParams: SwapParams = {
  //       mode: 'ExactIn',
  //       assetIn: PoolAssets.hTONAsset,
  //       assetOut: PoolAssets.tsTONAsset,
  //       amountIn: initAmountIn,
  //     };
  //     const simulateSwapResult = await torchSDK.simulateSwap(swapExactInParams);
  //     console.log('simulateSwapResult', simulateSwapResult);
  //     if (simulateSwapResult[1].mode != 'ExactIn') {
  //       throw new Error('Swap mode is not ExactIn');
  //     }
  //     console.log('simulateSwapResult[0].amountOut', simulateSwapResult[1].amountOut);
  //     // Exact Out
  //     const swapExactOutParams: SwapParams = {
  //       mode: 'ExactOut',
  //       assetIn: PoolAssets.hTONAsset,
  //       assetOut: PoolAssets.tsTONAsset,
  //       amountOut: simulateSwapResult[1].amountOut,
  //     };
  //     const simulateSwapExactOutResult = await torchSDK.simulateSwap(swapExactOutParams);
  //     console.log('simulateSwapExactOutResult', simulateSwapExactOutResult);
  //     if (simulateSwapExactOutResult[1].mode != 'ExactOut') {
  //       throw new Error('Swap mode is not ExactOut');
  //     }
  //     const finalAmountIn = simulateSwapExactOutResult[1].amountIn;
  //     const difference = abs(finalAmountIn, initAmountIn);
  //     expect(difference < toNano(0.01)).toBeTruthy();
  //   });
  //   it('should simulate deposit and swap', async () => {
  //     // Exact In
  //     const initAmountIn = toNano(0.05);
  //     const swapExactInParams: SwapParams = {
  //       mode: 'ExactIn',
  //       assetIn: PoolAssets.tonAsset,
  //       assetOut: PoolAssets.hTONAsset,
  //       amountIn: initAmountIn,
  //     };
  //     const simulateSwapResult = await torchSDK.simulateSwap(swapExactInParams);
  //     console.log(simulateSwapResult);
  //     if (simulateSwapResult[1].mode != 'ExactIn') {
  //       throw new Error('Swap mode is not ExactIn');
  //     }
  //     // Exact Out
  //     const swapExactOutParams: SwapParams = {
  //       mode: 'ExactOut',
  //       assetIn: PoolAssets.tonAsset,
  //       assetOut: PoolAssets.hTONAsset,
  //       amountOut: simulateSwapResult[1].amountOut,
  //     };
  //     const simulateSwapExactOutResult = await torchSDK.simulateSwap(swapExactOutParams);
  //     console.log(simulateSwapExactOutResult);
  //     if (simulateSwapExactOutResult[1].mode != 'ExactOut') {
  //       throw new Error('Swap mode is not ExactOut');
  //     }
  //     const finalAmountIn = simulateSwapExactOutResult[1].amountIn;
  //     const difference = abs(finalAmountIn, initAmountIn);
  //     expect(difference < toNano(0.01)).toBeTruthy();
  //   });
  //   it('should simulate deposit and deposit', async () => {
  //     // Exact In
  //     const initAmountIn = toNano(0.05);
  //     const swapExactInParams: SwapParams = {
  //       mode: 'ExactIn',
  //       assetIn: PoolAssets.tonAsset,
  //       assetOut: PoolAssets.quaTONAsset,
  //       amountIn: initAmountIn,
  //     };
  //     const simulateSwapResult = await torchSDK.simulateSwap(swapExactInParams);
  //     console.log(simulateSwapResult);
  //     if (simulateSwapResult[1].mode != 'ExactIn') {
  //       throw new Error('Swap mode is not ExactIn');
  //     }
  //     // Exact Out
  //     const swapExactOutParams: SwapParams = {
  //       mode: 'ExactOut',
  //       assetIn: PoolAssets.tonAsset,
  //       assetOut: PoolAssets.quaTONAsset,
  //       amountOut: simulateSwapResult[1].amountOut,
  //     };
  //     const simulateSwapExactOutResult = await torchSDK.simulateSwap(swapExactOutParams);
  //     console.log(simulateSwapExactOutResult);
  //     if (simulateSwapExactOutResult[1].mode != 'ExactOut') {
  //       throw new Error('Swap mode is not ExactOut');
  //     }
  //     const finalAmountIn = simulateSwapExactOutResult[1].amountIn;
  //     const difference = abs(finalAmountIn, initAmountIn);
  //     expect(difference < toNano(0.01)).toBeTruthy();
  //   });
  //   it('should simulate withdraw and withdraw', async () => {
  //     // Exact In
  //     const initAmountIn = 5n * 10n ** 17n;
  //     const swapExactInParams: SwapParams = {
  //       mode: 'ExactIn',
  //       assetIn: PoolAssets.quaTONAsset,
  //       assetOut: PoolAssets.tsTONAsset,
  //       amountIn: initAmountIn,
  //     };
  //     const simulateSwapResult = await torchSDK.simulateSwap(swapExactInParams);
  //     console.log(simulateSwapResult);
  //     if (simulateSwapResult[1].mode != 'ExactIn') {
  //       throw new Error('Swap mode is not ExactIn');
  //     }
  //     // Exact Out
  //     const swapExactOutParams: SwapParams = {
  //       mode: 'ExactOut',
  //       assetIn: PoolAssets.quaTONAsset,
  //       assetOut: PoolAssets.tsTONAsset,
  //       amountOut: simulateSwapResult[1].amountOut,
  //     };
  //     const simulateSwapExactOutResult = await torchSDK.simulateSwap(swapExactOutParams);
  //     console.log(simulateSwapExactOutResult);
  //     if (simulateSwapExactOutResult[1].mode != 'ExactOut') {
  //       throw new Error('Swap mode is not ExactOut');
  //     }
  //     const finalAmountIn = simulateSwapExactOutResult[1].amountIn;
  //     const difference = abs(finalAmountIn, initAmountIn);
  //     expect(difference < 1n * 10n ** 16n).toBeTruthy();
  //   });
  // });
  // describe('Withdraw', () => {
  //   it('should qwesimulate withdraw single', async () => {
  //     const withdrawParams: WithdrawParams = {
  //       mode: 'Single',
  //       pool: PoolConfig.triTONPoolAddress,
  //       burnLpAmount: 5n * 10n ** 18n,
  //       queryId: 1n,
  //       withdrawAsset: PoolAssets.tonAsset,
  //     };
  //     const simulateWithdrawResult = await torchSDK.simulateWithdraw(withdrawParams);
  //     console.log(simulateWithdrawResult);
  //   });
  //   it('should simulate withdraw balanced', async () => {
  //     const withdrawParams: WithdrawParams = {
  //       mode: 'Balanced',
  //       pool: PoolConfig.triTONPoolAddress,
  //       burnLpAmount: 5n * 10n ** 18n,
  //       queryId: 1n,
  //     };
  //     const simulateWithdrawResult = await torchSDK.simulateWithdraw(withdrawParams);
  //     console.log(simulateWithdrawResult);
  //   });
  //   it('should simulate withdraw balanced and withdraw balanced', async () => {
  //     const withdrawParams: WithdrawParams = {
  //       mode: 'Balanced',
  //       pool: PoolConfig.quaTONPoolAddress,
  //       burnLpAmount: 5n * 10n ** 18n,
  //       queryId: 1n,
  //       nextWithdraw: {
  //         mode: 'Balanced',
  //         pool: PoolConfig.triTONPoolAddress,
  //       },
  //     };
  //     const simulateWithdrawResult = await torchSDK.simulateWithdraw(withdrawParams);
  //     console.log(simulateWithdrawResult);
  //   });
  //   //   it('should simulate withdraw single and withdraw single', async () => {
  //   //     const withdrawParams: WithdrawParams = {
  //   //       mode: 'Single',
  //   //       pool: PoolConfig.quaTONPoolAddress,
  //   //       burnLpAmount: 5n * 10n ** 18n,
  //   //       queryId: 1n,
  //   //       nextWithdraw: {
  //   //         mode: 'Single',
  //   //         pool: PoolConfig.triTONPoolAddress,
  //   //         withdrawAsset: PoolAssets.tonAsset,
  //   //       },
  //   //     };
  //   //     const simulateWithdrawResult = await torchSDK.simulateWithdraw(withdrawParams);
  //   //     console.log(simulateWithdrawResult);
  //   //   });
  //   //   it('should simulate withdraw single and withdraw balanced', async () => {
  //   //     const withdrawParams: WithdrawParams = {
  //   //       mode: 'Single',
  //   //       pool: PoolConfig.quaTONPoolAddress,
  //   //       burnLpAmount: 5n * 10n ** 18n,
  //   //       queryId: 1n,
  //   //       nextWithdraw: {
  //   //         mode: 'Balanced',
  //   //         pool: PoolConfig.triTONPoolAddress,
  //   //       },
  //   //     };
  //   //     const simulateWithdrawResult = await torchSDK.simulateWithdraw(withdrawParams);
  //   //     console.log(simulateWithdrawResult);
  //   //   });
  //   //   it('should simulate withdraw all and withdraw single', async () => {
  //   //     const withdrawParams: WithdrawParams = {
  //   //       mode: 'Balanced',
  //   //       pool: PoolConfig.quaTONPoolAddress,
  //   //       burnLpAmount: 5n * 10n ** 18n,
  //   //       queryId: 1n,
  //   //       nextWithdraw: {
  //   //         mode: 'Single',
  //   //         pool: PoolConfig.triTONPoolAddress,
  //   //         withdrawAsset: PoolAssets.tonAsset,
  //   //       },
  //   //     };
  //   //     const simulateWithdrawResult = await torchSDK.simulateWithdraw(withdrawParams);
  //   //     console.log(simulateWithdrawResult);
  //   //   });
  // });
});
