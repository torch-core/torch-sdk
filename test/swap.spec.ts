import { Blockchain, BlockchainSnapshot, SandboxContract } from '@ton/sandbox';
import { TorchSDK } from '../src';
import { initialize } from './setup';
import { PoolAssets } from './config';
import { Address, SenderArguments, toNano } from '@ton/core';
import { SwapParams } from '../src/types/swap';
import { JettonMaster, JettonWallet } from '@ton/ton';
import { checkJettonBalDecrease, checkJettonBalIncrease, checkJettonBalNotChanged, checkTONBalDecrease } from './check';
import { abs } from './abs';

describe('Swap Testcases', () => {
  // set timeout: 6 minutes
  jest.setTimeout(360000);

  let torchSDK: TorchSDK;
  let sender: Address;
  let blockchain: Blockchain;
  let initBlockchainState: BlockchainSnapshot;

  // Jetton Master
  let stTON: SandboxContract<JettonMaster>;
  //   let tsTON: SandboxContract<JettonMaster>;
  let hTON: SandboxContract<JettonMaster>;

  // Sender Jetton Wallet
  let senderStTONWallet: SandboxContract<JettonWallet>;
  let senderTsTONWallet: SandboxContract<JettonWallet>;
  let senderHTONWallet: SandboxContract<JettonWallet>;
  let senderTriTONWallet: SandboxContract<JettonWallet>;

  // Sender Asset Balance Before
  let senderTonBalBefore: bigint;
  let senderStTONBalBefore: bigint;
  let senderTsTONBalBefore: bigint;
  let senderHTONBalBefore: bigint;
  let senderTriTONBalBefore: bigint;

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
      senderHTONWallet,
      senderTriTONWallet,
      stTON,
      //   tsTON,
      hTON,
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
    senderHTONBalBefore = await senderHTONWallet.getBalance();
    senderTriTONBalBefore = await senderTriTONWallet.getBalance();
  });

  async function swapImpactTriTON() {
    const swapFluctuateParams: SwapParams = {
      mode: 'ExactIn',
      assetIn: PoolAssets.tsTONAsset,
      assetOut: PoolAssets.stTONAsset,
      amountIn: toNano('0.5'),
    };
    const sendFluctuateArgs = await torchSDK.getSwapPayload(sender, swapFluctuateParams);
    await send(sendFluctuateArgs);

    // Reset balance
    senderStTONBalBefore = await senderStTONWallet.getBalance();
    senderTsTONBalBefore = await senderTsTONWallet.getBalance();
  }

  async function swapImpactQuaTON() {
    const swapFluctuateParams: SwapParams = {
      mode: 'ExactIn',
      assetIn: PoolAssets.triTONAsset,
      assetOut: PoolAssets.hTONAsset,
      amountIn: 1n * 10n ** 18n,
    };
    const sendFluctuateArgs = await torchSDK.getSwapPayload(sender, swapFluctuateParams);
    await send(sendFluctuateArgs);

    // Reset balance
    senderTriTONBalBefore = await senderTriTONWallet.getBalance();
    senderHTONBalBefore = await senderHTONWallet.getBalance();
  }

  describe('TriTON Pool', () => {
    it('should swap tsTON to stTON (ExactIn + ExactOut)', async () => {
      // Build swap exact in payload
      const amountIn = toNano('0.05');
      const swapExactInParams: SwapParams = {
        mode: 'ExactIn',
        assetIn: PoolAssets.tsTONAsset,
        assetOut: PoolAssets.stTONAsset,
        amountIn,
      };

      // Send swap
      const sendExactInArgs = await torchSDK.getSwapPayload(sender, swapExactInParams);
      await send(sendExactInArgs);

      // Sender stTON balance should be increased
      await checkJettonBalIncrease(senderStTONWallet, senderStTONBalBefore);
      const swapOutAmount = (await senderStTONWallet.getBalance()) - senderStTONBalBefore;

      // Sender tsTON balance should be decreased
      await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn);

      // Restore blockchain state
      await blockchain.loadFrom(initBlockchainState);

      // Build swap exact out payload
      const swapExactOutParams: SwapParams = {
        mode: 'ExactOut',
        assetIn: PoolAssets.tsTONAsset,
        assetOut: PoolAssets.stTONAsset,
        amountOut: swapOutAmount,
      };

      // Send swap
      const sendExactOutArgs = await torchSDK.getSwapPayload(sender, swapExactOutParams);
      await send(sendExactOutArgs);

      // Get sender tsTON balance decrease amount
      const senderTsTONBalAfter = await senderTsTONWallet.getBalance();
      const tsTONBalDecrease = senderTsTONBalBefore - senderTsTONBalAfter;

      // Check if the difference is less than 0.01
      const difference = abs(tsTONBalDecrease, amountIn);
      expect(difference < toNano(0.01)).toBeTruthy();
    });

    it('should refund tsTON to sender when min amount out is not met (tsTON -> stTON ExactIn)', async () => {
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
      await swapImpactTriTON();

      // Send swap
      const sendSlipageArgs = await torchSDK.getSwapPayload(sender, swapSlipageParams);
      await send(sendSlipageArgs);

      // Sender stTON balance should be not changed
      await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
    });

    it('should refund tsTON to sender when slippage not met (tsTON -> stTON ExactIn)', async () => {
      // Build swap paylaod with min amount out
      const amountIn = toNano('0.05');
      const swapParams: SwapParams = {
        mode: 'ExactIn',
        assetIn: PoolAssets.tsTONAsset,
        assetOut: PoolAssets.stTONAsset,
        amountIn,
        slippageTolerance: 0.01,
      };

      // Send swap
      const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

      // Someone swap to make the price fluctuate
      await swapImpactTriTON();

      // Send swap
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
      await swapImpactTriTON();

      // Send swap
      const sendSlipageArgs = await torchSDK.getSwapPayload(sender, swapSlipageParams);
      await send(sendSlipageArgs);

      // Sender stTON balance should be not changed
      await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
    });

    it('should refund tsTON to sender when min amount out is not met (tsTON -> stTON ExactOut)', async () => {
      // Build swap paylaod with min amount out
      const amountOut = toNano('1');
      const swapParams: SwapParams = {
        mode: 'ExactOut',
        assetIn: PoolAssets.tsTONAsset,
        assetOut: PoolAssets.stTONAsset,
        amountOut,
        minAmountOut: toNano('1.5'),
      };

      // Send swap
      const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
      await send(sendArgs);

      // Sender stTON balance should be not changed
      await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
    });

    it('should refund tsTON to sender when slippage not met (tsTON -> stTON ExactOut)', async () => {
      // Build swap payload with slippage
      const amountOut = toNano('1');
      const swapSlipageParams: SwapParams = {
        mode: 'ExactOut',
        assetIn: PoolAssets.tsTONAsset,
        assetOut: PoolAssets.stTONAsset,
        amountOut,
        slippageTolerance: 0.01,
      };

      // Someone swap to make the price fluctuate
      await swapImpactTriTON();

      // Send swap
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

    it('should swap TON to stTON with recipient', async () => {
      // Build swap paylaod
      const recipient = await blockchain.treasury('recipient');
      const amountIn = toNano('0.05');
      const swapParams: SwapParams = {
        mode: 'ExactIn',
        assetIn: PoolAssets.tonAsset,
        assetOut: PoolAssets.stTONAsset,
        amountIn,
        recipient: recipient.address,
      };

      // Send swap
      const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
      await send(sendArgs);

      // Expect recipient stTON balance should be increased
      const recipientStTONWallet = blockchain.openContract(
        JettonWallet.create(await stTON.getWalletAddress(recipient.address)),
      );
      await checkJettonBalIncrease(recipientStTONWallet, 0n);
    });
  });

  describe('Cross pool swap', () => {
    describe('Deposit and swap', () => {
      it('should swap tsTON to hTON (ExactIn + ExactOut)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapExactInParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.hTONAsset,
          amountIn,
        };

        // Send swap
        const sendExactInArgs = await torchSDK.getSwapPayload(sender, swapExactInParams);
        await send(sendExactInArgs);

        // Sender hTON balance should be increased
        await checkJettonBalIncrease(senderHTONWallet, senderHTONBalBefore);

        // Get amount of hTON received
        const hTONBalIncrease = (await senderHTONWallet.getBalance()) - senderHTONBalBefore;

        // Sender tsTON balance should be decreased
        await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn);

        // Restore blockchain state
        await blockchain.loadFrom(initBlockchainState);

        // Build swap payload
        const swapExactOutParams: SwapParams = {
          mode: 'ExactOut',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.hTONAsset,
          amountOut: hTONBalIncrease,
        };

        // Send swap
        const sendExactOutArgs = await torchSDK.getSwapPayload(sender, swapExactOutParams);
        await send(sendExactOutArgs);

        // Sender hTON balance should be increased
        await checkJettonBalIncrease(senderHTONWallet, senderHTONBalBefore);

        // Sender tsTON balance should be decreased
        await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn);

        // Get amount of tsTON decreases
        const tsTONBalDecrease = senderTsTONBalBefore - (await senderTsTONWallet.getBalance());

        // Check if the difference is less than 0.01
        const difference = abs(tsTONBalDecrease, amountIn);
        expect(difference < toNano(0.01)).toBeTruthy();
      });

      it('should swap tsTON to hTON with recipient(Deposit and Swap)', async () => {
        // Build swap payload
        const recipient = await blockchain.treasury('recipient');
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.hTONAsset,
          amountIn,
          recipient: recipient.address,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
        await send(sendArgs);

        // Expect recipient hTON balance should be increased
        const recipientHTONWallet = blockchain.openContract(
          JettonWallet.create(await hTON.getWalletAddress(recipient.address)),
        );
        await checkJettonBalIncrease(recipientHTONWallet, 0n);
      });

      it('should refund tsTON to sender when min amount out is not met (tsTON -> hTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.hTONAsset,
          amountIn,
          minAmountOut: toNano('1'), // This is minAmountOut is too big, so it should be refunded in the first pool
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
        await send(sendArgs);

        // Sender hTON balance should not be changed
        await checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore);

        // Sender tsTON balance should not be changed
        await checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore);
      });

      it('should refund TriTON to sender when min amount out is not met (tsTON -> hTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.hTONAsset,
          amountIn,
          minAmountOut: 44546240n, // This is minAmountOut is too big, so it should be refunded in the first pool
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

        // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the first pool
        await swapImpactQuaTON();

        // Send swap
        await send(sendArgs);

        // Sender hTON balance should not be changed
        await checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore);

        // Sender tsTON balance should be decreased
        await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn);

        // Sender triTON balance should be increased
        await checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore);
      });

      it('should refund tsTON to sender when slippage not met (tsTON -> hTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.hTONAsset,
          amountIn,
          slippageTolerance: 0.01,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

        // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the first pool
        await swapImpactTriTON();

        // Send swap
        await send(sendArgs);

        // Sender hTON balance should not be changed
        await checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore);

        // Sender tsTON balance should not be changed
        await checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore);
      });

      it('should refund TriTON to sender when slippage not met (tsTON -> hTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.hTONAsset,
          amountIn,
          slippageTolerance: 0.01,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

        // Someone swap to make the price fluctuate in QuaTON pool, so that it will be refunded in the second pool
        await swapImpactQuaTON();

        // Send swap
        await send(sendArgs);

        // Sender hTON balance should not be changed
        await checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore);

        // Sender tsTON balance should be decreased
        await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn);

        // Sender triTON balance should be increased due to the refund
        await checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore);
      });
    });
  });
});
