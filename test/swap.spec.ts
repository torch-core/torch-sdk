import { Blockchain, BlockchainSnapshot, SandboxContract } from '@ton/sandbox';
import { TorchSDK } from '../src';
import { initialize } from './setup';
import { PoolAssets } from './config';
import { Address, SenderArguments, toNano } from '@ton/core';
import { SwapParams } from '../src/types/swap';
import { JettonWallet } from '@ton/ton';
import { checkJettonBalDecrease, checkJettonBalIncrease, checkJettonBalNotChanged, checkTONBalDecrease } from './check';

describe('Swap Testcases', () => {
  // set timeout: 6 minutes
  jest.setTimeout(360000);

  let torchSDK: TorchSDK;
  let sender: Address;
  let blockchain: Blockchain;
  let initBlockchainState: BlockchainSnapshot;

  // Sender Jetton Wallet
  let senderStTONWallet: SandboxContract<JettonWallet>;
  let senderTsTONWallet: SandboxContract<JettonWallet>;
  //   let senderHTONWallet: SandboxContract<JettonWallet>;

  // Sender Asset Balance Before
  let senderTonBalBefore: bigint;
  let senderStTONBalBefore: bigint;
  let senderTsTONBalBefore: bigint;
  //   let senderHTONBalBefore: bigint;

  // Send function
  let send: (args: SenderArguments[] | SenderArguments) => Promise<void>;
  beforeAll(async () => {
    ({
      torchSDK,
      blockchain,
      //   factory,
      sender,
      //   triTONPool,
      senderStTONWallet,
      senderTsTONWallet,
      //   senderHTONWallet,
      send,
    } = await initialize());

    initBlockchainState = blockchain.snapshot();
  });

  beforeEach(async () => {
    // Reset blockchain state
    await blockchain.loadFrom(initBlockchainState);

    // Get sender balance
    senderTonBalBefore = await (await blockchain.getContract(sender)).balance;
    senderStTONBalBefore = await senderStTONWallet.getBalance();
    senderTsTONBalBefore = await senderTsTONWallet.getBalance();
    // senderHTONBalBefore = await senderHTONWallet.getBalance();
  });

  async function swapImpact() {
    const swapFluctuateParams: SwapParams = {
      mode: 'ExactIn',
      assetIn: PoolAssets.tsTONAsset,
      assetOut: PoolAssets.stTONAsset,
      amountIn: toNano('1'),
    };
    const sendFluctuateArgs = await torchSDK.getSwapPayload(sender, swapFluctuateParams);
    await send(sendFluctuateArgs);
  }

  describe('TriTON Pool', () => {
    it('should swap tsTON to stTON', async () => {
      // Build swap paylaod
      const amountIn = toNano('0.05');
      const swapParams: SwapParams = {
        mode: 'ExactIn',
        assetIn: PoolAssets.tsTONAsset,
        assetOut: PoolAssets.stTONAsset,
        amountIn,
      };

      // Send swap
      const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
      await send(sendArgs);

      // Sender stTON balance should be increased
      await checkJettonBalIncrease(senderStTONWallet, senderStTONBalBefore);

      // Sender tsTON balance should be decreased
      await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn);
    });

    it('should refund tsTON to sender when min amount out is not met (tsTON -> stTON)', async () => {
      // Build swap paylaod with min amount out
      const amountIn = toNano('0.05');
      const swapParams: SwapParams = {
        mode: 'ExactIn',
        assetIn: PoolAssets.tsTONAsset,
        assetOut: PoolAssets.stTONAsset,
        amountIn,
        minAmountOut: toNano('1'),
      };

      // Send swap
      const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
      await send(sendArgs);

      // Sender stTON balance should be not changed
      await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);

      // Build swap payload with slippage
      const swapSlipageParams: SwapParams = {
        mode: 'ExactIn',
        assetIn: PoolAssets.tsTONAsset,
        assetOut: PoolAssets.stTONAsset,
        amountIn,
        slippageTolerance: 0.01,
      };

      // Someone swap to make the price fluctuate
      await swapImpact();

      // Send swap
      senderStTONBalBefore = await senderStTONWallet.getBalance();
      const sendSlipageArgs = await torchSDK.getSwapPayload(sender, swapSlipageParams);
      await send(sendSlipageArgs);

      // Sender stTON balance should be not changed
      await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
    });

    it('should swap TON to stTON', async () => {
      // Build swap paylaod
      const amountIn = toNano('0.05');
      const swapParams: SwapParams = {
        mode: 'ExactIn',
        assetIn: PoolAssets.tonAsset,
        assetOut: PoolAssets.stTONAsset,
        amountIn,
      };

      // Send swap
      const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
      await send(sendArgs);

      // Sender stTON balance should be increased
      await checkJettonBalIncrease(senderStTONWallet, senderStTONBalBefore);

      // Sender TON balance should be decreased
      await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
    });
  });
});
