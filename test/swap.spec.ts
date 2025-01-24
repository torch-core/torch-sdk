import { Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { SwapParams, TorchSDK } from '../src';
import { initialize } from './setup';
import { PoolAssets } from './config';
import { Address, SenderArguments, toNano } from '@ton/core';
import { JettonMaster, JettonWallet } from '@ton/ton';
import {
  checkJettonBalDecrease,
  checkJettonBalIncrease,
  checkJettonBalNotChanged,
  checkTONBalDecrease,
} from './helper/check';
import { abs } from './helper/abs';
import { Pool } from '@torch-finance/dex-contract-wrapper';
import { Asset } from '@torch-finance/core';

describe('Swap Testcases', () => {
  // set timeout: 6 minutes
  jest.setTimeout(360000);

  let torchSDK: TorchSDK;
  let sender: Address;
  let recipient: SandboxContract<TreasuryContract>;
  let blockchain: Blockchain;
  let initBlockchainState: BlockchainSnapshot;
  let quaTONPool: SandboxContract<Pool>;

  // Jetton Master
  let stTON: SandboxContract<JettonMaster>;
  let tsTON: SandboxContract<JettonMaster>;
  let hTON: SandboxContract<JettonMaster>;

  // Sender Jetton Wallet
  let senderStTONWallet: SandboxContract<JettonWallet>;
  let senderTsTONWallet: SandboxContract<JettonWallet>;
  let senderHTONWallet: SandboxContract<JettonWallet>;
  let senderTriTONWallet: SandboxContract<JettonWallet>;
  let senderQuaTONWallet: SandboxContract<JettonWallet>;

  // Recipient Jetton Wallet
  let recipientStTONWallet: SandboxContract<JettonWallet>;
  let recipientTsTONWallet: SandboxContract<JettonWallet>;
  let recipientHTONWallet: SandboxContract<JettonWallet>;
  let recipientQuaTONWallet: SandboxContract<JettonWallet>;

  // Sender Asset Balance Before
  let senderTonBalBefore: bigint;
  let senderStTONBalBefore: bigint;
  let senderTsTONBalBefore: bigint;
  let senderHTONBalBefore: bigint;
  let senderTriTONBalBefore: bigint;
  let senderQuaTONBalBefore: bigint;

  // Send function
  let send: (args: SenderArguments[] | SenderArguments) => Promise<void>;

  let swapImpactTriTON: (assetIn?: Asset, assetOut?: Asset) => Promise<void>;
  let swapImpactQuaTON: (assetIn?: Asset, assetOut?: Asset, amountIn?: bigint) => Promise<void>;

  beforeAll(async () => {
    ({
      torchSDK,
      blockchain,
      sender,
      quaTONPool,
      senderStTONWallet,
      senderTsTONWallet,
      senderHTONWallet,
      senderTriTONWallet,
      senderQuaTONWallet,
      stTON,
      tsTON,
      hTON,
      send,
      swapImpactTriTON,
      swapImpactQuaTON,
    } = await initialize());
    recipient = await blockchain.treasury('recipient');
    recipientStTONWallet = await blockchain.openContract(
      JettonWallet.create(await stTON.getWalletAddress(recipient.address)),
    );
    recipientTsTONWallet = await blockchain.openContract(
      JettonWallet.create(await tsTON.getWalletAddress(recipient.address)),
    );
    recipientHTONWallet = await blockchain.openContract(
      JettonWallet.create(await hTON.getWalletAddress(recipient.address)),
    );
    recipientQuaTONWallet = await blockchain.openContract(
      JettonWallet.create(await quaTONPool.getWalletAddress(recipient.address)),
    );

    initBlockchainState = blockchain.snapshot();
  });

  beforeEach(async () => {
    // Reset blockchain state
    await blockchain.loadFrom(initBlockchainState);

    // Get sender balance
    senderTonBalBefore = (await blockchain.getContract(sender)).balance;
    senderStTONBalBefore = await senderStTONWallet.getBalance();
    senderTsTONBalBefore = await senderTsTONWallet.getBalance();
    senderHTONBalBefore = await senderHTONWallet.getBalance();
    senderTriTONBalBefore = await senderTriTONWallet.getBalance();
    senderQuaTONBalBefore = await senderQuaTONWallet.getBalance();
  });

  describe('Swap in TriTON Pool', () => {
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

      // Reset balance
      senderStTONBalBefore = await senderStTONWallet.getBalance();
      senderTsTONBalBefore = await senderTsTONWallet.getBalance();

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

      // Reset balance
      senderStTONBalBefore = await senderStTONWallet.getBalance();
      senderTsTONBalBefore = await senderTsTONWallet.getBalance();

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

      // Reset balance
      senderStTONBalBefore = await senderStTONWallet.getBalance();
      senderTsTONBalBefore = await senderTsTONWallet.getBalance();

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

      // Reset balance
      senderStTONBalBefore = await senderStTONWallet.getBalance();
      senderTsTONBalBefore = await senderTsTONWallet.getBalance();

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

      // Recipient stTON balance should be increased
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

        // Recipient hTON balance should be increased
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
          minAmountOut: 44546240n,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

        // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the first pool
        await swapImpactQuaTON();

        // Reset balance
        senderTriTONBalBefore = await senderTriTONWallet.getBalance();
        senderHTONBalBefore = await senderHTONWallet.getBalance();

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

        // Reset balance
        senderStTONBalBefore = await senderStTONWallet.getBalance();
        senderTsTONBalBefore = await senderTsTONWallet.getBalance();

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

        // Reset balance
        senderTriTONBalBefore = await senderTriTONWallet.getBalance();
        senderHTONBalBefore = await senderHTONWallet.getBalance();

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

    describe('Swap and Withdraw', () => {
      it('should swap hTON to tsTON (ExactIn + ExactOut)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapExactInParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.hTONAsset,
          assetOut: PoolAssets.tsTONAsset,
          amountIn,
        };

        // Send swap
        const sendExactInArgs = await torchSDK.getSwapPayload(sender, swapExactInParams);
        await send(sendExactInArgs);

        // Sender tsTON balance should be increased
        await checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore);

        // Sender hTON balance should be decreased
        await checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore, amountIn);

        const expectedAmountOut = (await senderTsTONWallet.getBalance()) - senderTsTONBalBefore;

        // Restore blockchain state
        await blockchain.loadFrom(initBlockchainState);

        // Build swap payload
        const swapExactOutParams: SwapParams = {
          mode: 'ExactOut',
          assetIn: PoolAssets.hTONAsset,
          assetOut: PoolAssets.tsTONAsset,
          amountOut: expectedAmountOut,
        };

        // Send swap
        const sendExactOutArgs = await torchSDK.getSwapPayload(sender, swapExactOutParams);
        await send(sendExactOutArgs);

        // Sender tsTON balance should be increased
        await checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore);

        // Sender hTON balance should be decreased
        await checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore, amountIn);

        // Get amount of hTON decreases
        const hTONBalDecrease = senderHTONBalBefore - (await senderHTONWallet.getBalance());

        // Check if the difference is less than 0.01
        const difference = abs(hTONBalDecrease, amountIn);
        expect(difference < toNano(0.01)).toBeTruthy();
      });

      it('should swap hTON to tsTON with recipient', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.hTONAsset,
          assetOut: PoolAssets.tsTONAsset,
          amountIn,
          recipient: recipient.address,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
        await send(sendArgs);

        // Recipient tsTON balance should be increased
        await checkJettonBalIncrease(recipientTsTONWallet, 0n);
      });

      it('should refund hTON to sender when min amount out is not met (hTON -> stTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.hTONAsset,
          assetOut: PoolAssets.stTONAsset,
          amountIn,
          minAmountOut: toNano('1'), // This is minAmountOut is too big, so it should be refunded in the first pool
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
        await send(sendArgs);

        // Sender hTON balance should not be changed
        await checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore);

        // Sender stTON balance should not be changed
        await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
      });

      it('should refund TriTON to sender when min amount out is not met (hTON -> stTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.hTONAsset,
          assetOut: PoolAssets.stTONAsset,
          amountIn,
          minAmountOut: 57811266n,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

        // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the second pool
        await swapImpactTriTON();

        // Reset balance
        senderStTONBalBefore = await senderStTONWallet.getBalance();
        senderTsTONBalBefore = await senderTsTONWallet.getBalance();

        // Send swap
        await send(sendArgs);

        // Sender hTON balance should be decreased
        await checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore, amountIn);

        // Sender stTON balance should not be changed
        await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);

        // Sender triTON balance should be increased
        await checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore);
      });

      it('should refund hTON to sender when slippage is not met (hTON -> stTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.hTONAsset,
          assetOut: PoolAssets.stTONAsset,
          amountIn,
          slippageTolerance: 0.01,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

        // Someone swap to make the price fluctuate in QuaTON pool, so that it will be refunded in the second pool
        await swapImpactQuaTON();

        // Reset balance
        senderTriTONBalBefore = await senderTriTONWallet.getBalance();
        senderHTONBalBefore = await senderHTONWallet.getBalance();

        // Send swap
        await send(sendArgs);

        // Sender hTON balance should not be changed
        await checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore);

        // Sender stTON balance should not be changed
        await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
      });

      it('should refund TriTON to sender when slippage is not met (hTON -> stTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.hTONAsset,
          assetOut: PoolAssets.stTONAsset,
          amountIn,
          slippageTolerance: 0.01,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

        // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the second pool
        await swapImpactTriTON();

        // Reset balance
        senderStTONBalBefore = await senderStTONWallet.getBalance();
        senderTsTONBalBefore = await senderTsTONWallet.getBalance();

        // Send swap
        await send(sendArgs);

        // Sender hTON balance should be decreased
        await checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore, amountIn);

        // Sender stTON balance should not be changed
        await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);

        // Sender triTON balance should be increased
        await checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore);
      });
    });

    describe('Deposit and Deposit', () => {
      it('should swap tsTON to quaTON (ExactIn + ExactOut)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapExactInParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.quaTONAsset,
          amountIn,
        };

        // Send swap
        const sendExactInArgs = await torchSDK.getSwapPayload(sender, swapExactInParams);
        await send(sendExactInArgs);

        // Sender tsTON balance should be decreased
        await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn);

        // Sender quaTON balance should be increased
        await checkJettonBalIncrease(senderQuaTONWallet, senderQuaTONBalBefore);

        const expectedAmountOut = (await senderQuaTONWallet.getBalance()) - senderQuaTONBalBefore;

        // Restore blockchain state
        await blockchain.loadFrom(initBlockchainState);

        // Build swap payload
        const swapExactOutParams: SwapParams = {
          mode: 'ExactOut',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.quaTONAsset,
          amountOut: expectedAmountOut,
        };

        // Send swap
        const sendExactOutArgs = await torchSDK.getSwapPayload(sender, swapExactOutParams);
        await send(sendExactOutArgs);

        // Sender tsTON balance should be decreased
        await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn);

        // Sender quaTON balance should be increased
        await checkJettonBalIncrease(senderQuaTONWallet, senderQuaTONBalBefore);

        // Get amount of tsTON decreases
        const tsTONBalDecrease = senderTsTONBalBefore - (await senderTsTONWallet.getBalance());

        // Check if the difference is less than 0.01
        const difference = abs(tsTONBalDecrease, amountIn);
        expect(difference < toNano(0.01)).toBeTruthy();
      });

      it('should swap tsTON to quaTON with recipient', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.quaTONAsset,
          amountIn,
          recipient: recipient.address,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
        await send(sendArgs);

        // Recipient tsTON balance should be increased
        await checkJettonBalIncrease(recipientQuaTONWallet, 0n);
      });

      it('should refund tsTON to sender when min amount out is not met (tsTON -> quaTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.quaTONAsset,
          amountIn,
          minAmountOut: 10n ** 18n,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
        await send(sendArgs);

        // Sender tsTON balance should not be changed
        await checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore);

        // Sender quaTON balance should not be changed
        await checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore);
      });

      it('should refund quaTON to sender when min amount out is not met (tsTON -> quaTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.quaTONAsset,
          amountIn,
          minAmountOut: 49435630261982097n,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

        // Someone swap to make the price fluctuate in QuaTON pool, so that it will be refunded in the second pool
        await swapImpactQuaTON();

        // Reset balance
        senderTriTONBalBefore = await senderTriTONWallet.getBalance();
        senderHTONBalBefore = await senderHTONWallet.getBalance();

        // Send swap
        await send(sendArgs);

        // Sender tsTON balance should be decreased
        await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn);

        // Sender quaTON balance should not be changed
        await checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore);
      });

      it('should refund tsTON to sender when slippage is not met (tsTON -> quaTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.quaTONAsset,
          amountIn,
          slippageTolerance: 0.01,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

        // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the second pool
        await swapImpactTriTON();

        // Reset balance
        senderStTONBalBefore = await senderStTONWallet.getBalance();
        senderTsTONBalBefore = await senderTsTONWallet.getBalance();

        // Send swap
        await send(sendArgs);

        // Sender tsTON balance should not be changed
        await checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore);

        // Sender quaTON balance should not be changed
        await checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore);
      });

      it('should refund triTON to sender when slippage is not met (tsTON -> quaTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = toNano('0.05');
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.tsTONAsset,
          assetOut: PoolAssets.quaTONAsset,
          amountIn,
          slippageTolerance: 0.01,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

        // Someone swap to make the price fluctuate in QuaTON pool, so that it will be refunded in the second pool
        await swapImpactQuaTON();

        // Reset balance
        senderTriTONBalBefore = await senderTriTONWallet.getBalance();
        senderHTONBalBefore = await senderHTONWallet.getBalance();

        // Send swap
        await send(sendArgs);

        // Sender tsTON balance should be decreased
        await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn);

        // Sender triTON balance should be increased
        await checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore);
      });
    });

    describe('Withdraw and Withdraw', () => {
      it('should swap quaTON to tsTON (ExactIn + ExactOut)', async () => {
        // Build swap payload
        const amountIn = 10n ** 16n;
        const swapExactInParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.quaTONAsset,
          assetOut: PoolAssets.tsTONAsset,
          amountIn,
        };

        // Send swap
        const sendExactInArgs = await torchSDK.getSwapPayload(sender, swapExactInParams);
        await send(sendExactInArgs);

        // Sender quaTON balance should be decreased
        await checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, amountIn);

        // Sender tsTON balance should be increased
        await checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore);

        const expectedAmountOut = (await senderTsTONWallet.getBalance()) - senderTsTONBalBefore;

        // Restore blockchain state
        await blockchain.loadFrom(initBlockchainState);

        // Build swap payload
        const swapExactOutParams: SwapParams = {
          mode: 'ExactOut',
          assetIn: PoolAssets.quaTONAsset,
          assetOut: PoolAssets.tsTONAsset,
          amountOut: expectedAmountOut,
        };

        // Send swap
        const sendExactOutArgs = await torchSDK.getSwapPayload(sender, swapExactOutParams);
        await send(sendExactOutArgs);

        // Sender quaTON balance should be decreased
        await checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, amountIn);

        // Sender tsTON balance should be increased
        await checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore);

        // Get amount of quaTON decreases
        const quaTONBalDecrease = senderQuaTONBalBefore - (await senderQuaTONWallet.getBalance());

        // Check if the difference is less than 0.01 LP
        const difference = abs(quaTONBalDecrease, amountIn);
        expect(difference < 10n ** 16n).toBeTruthy();
      });

      it('should swap quaTON to tsTON with recipient', async () => {
        // Build swap payload
        const amountIn = 10n ** 16n;
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.quaTONAsset,
          assetOut: PoolAssets.tsTONAsset,
          amountIn,
          recipient: recipient.address,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
        await send(sendArgs);

        // Sender quaTON balance should be decreased
        await checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, amountIn);

        // Sender tsTON balance should be not changed
        await checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore);

        // Recipient tsTON balance should be increased
        await checkJettonBalIncrease(recipientTsTONWallet, 0n);
      });

      it('should refund quaTON to sender when min amount out is not met (quaTON -> stTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = 10n ** 16n;
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.quaTONAsset,
          assetOut: PoolAssets.stTONAsset,
          amountIn,
          minAmountOut: toNano('1'),
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
        await send(sendArgs);

        // Sender quaTON balance should not be changed
        await checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore);

        // Sender stTON balance should not be changed
        await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
      });

      it('should refund TriTON to sender when min amount out is not met (quaTON -> stTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = 10n ** 16n;
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.quaTONAsset,
          assetOut: PoolAssets.stTONAsset,
          amountIn,
          minAmountOut: 10544497n,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

        // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the second pool
        await swapImpactTriTON();

        // Reset balance
        senderStTONBalBefore = await senderStTONWallet.getBalance();
        senderTsTONBalBefore = await senderTsTONWallet.getBalance();

        // Send swap
        await send(sendArgs);

        // Sender quaTON balance should be decreased
        await checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, amountIn);

        // Sender stTON balance should not be changed
        await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
      });

      it('should refund quaTON to sender when slippage is not met (quaTON -> stTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = 10n ** 16n;
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.quaTONAsset,
          assetOut: PoolAssets.stTONAsset,
          amountIn,
          slippageTolerance: 0.01,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

        // Someone swap to make the price fluctuate in QuaTON pool, so that it will be refunded in the second pool
        const swapFluctuateParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.hTONAsset,
          assetOut: PoolAssets.tsTONAsset,
          amountIn: toNano('1'),
        };
        const sendFluctuateArgs = await torchSDK.getSwapPayload(sender, swapFluctuateParams);
        await send(sendFluctuateArgs);

        // Reset balance
        senderTriTONBalBefore = await senderTriTONWallet.getBalance();
        senderHTONBalBefore = await senderHTONWallet.getBalance();

        // Send swap
        await send(sendArgs);

        // Sender quaTON balance should not be changed
        await checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore);

        // Sender stTON balance should not be changed
        await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
      });

      it('should refund stTON to sender when slippage is not met (quaTON -> stTON ExactIn)', async () => {
        // Build swap payload
        const amountIn = 10n ** 16n;
        const swapParams: SwapParams = {
          mode: 'ExactIn',
          assetIn: PoolAssets.quaTONAsset,
          assetOut: PoolAssets.stTONAsset,
          amountIn,
          slippageTolerance: 0.01,
        };

        // Send swap
        const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);

        // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the second pool
        await swapImpactTriTON();

        // Reset balance
        senderStTONBalBefore = await senderStTONWallet.getBalance();
        senderTsTONBalBefore = await senderTsTONWallet.getBalance();

        // Send swap
        await send(sendArgs);

        // Sender quaTON balance should be decreased
        await checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, amountIn);

        // Sender stTON balance should not be changed
        await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);

        // Sender TriTON balance should be increased
        await checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore);
      });
    });
  });
});
