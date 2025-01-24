import { Blockchain, BlockchainSnapshot, SandboxContract } from '@ton/sandbox';
import { TorchSDK, WithdrawParams } from '../src';
import { initialize } from './setup';
import { PoolAssets } from './config';
import { Address, SenderArguments, toNano } from '@ton/core';
import { SwapParams } from '../src/types/swap';
import { JettonMaster, JettonWallet } from '@ton/ton';
import {
  checkJettonBalDecrease,
  checkJettonBalIncrease,
  checkJettonBalNotChanged,
  checkTONBalDecrease,
  checkTONBalIncrease,
} from './helper/check';
import { Pool } from '@torch-finance/dex-contract-wrapper';

describe('Withdraw Testcases', () => {
  // set timeout: 6 minutes
  jest.setTimeout(360000);

  let torchSDK: TorchSDK;
  let sender: Address;
  let blockchain: Blockchain;
  let initBlockchainState: BlockchainSnapshot;
  let triTONPool: SandboxContract<Pool>;
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

  // Sender Asset Balance Before
  let senderTonBalBefore: bigint;
  let senderStTONBalBefore: bigint;
  let senderTsTONBalBefore: bigint;
  let senderTriTONBalBefore: bigint;
  let senderQuaTONBalBefore: bigint;
  let senderHTONBalBefore: bigint;

  async function swapImpactTriTON() {
    const swapFluctuateParams: SwapParams = {
      mode: 'ExactIn',
      assetIn: PoolAssets.tsTONAsset,
      assetOut: PoolAssets.stTONAsset,
      amountIn: toNano('5'),
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

  // Send function
  let send: (args: SenderArguments[] | SenderArguments) => Promise<void>;
  beforeAll(async () => {
    ({
      torchSDK,
      blockchain,
      sender,
      triTONPool,
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
    } = await initialize());

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

  describe('Withdraw in TriTON Pool', () => {
    it('should withdraw all in triTON pool', async () => {
      // Build withdraw payload
      const withdrawParams: WithdrawParams = {
        mode: 'Balanced',
        pool: triTONPool.address,
        burnLpAmount: 1n * 10n ** 18n,
        queryId: 1n,
      };

      // Send withdraw
      const withdrawArgs = await torchSDK.getWithdrawPayload(sender, withdrawParams);
      await send(withdrawArgs);

      // Sender TriTON balance should be decreased
      await checkJettonBalDecrease(senderTriTONWallet, senderTriTONBalBefore);

      // Sender tsTON balance should be increased
      await checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore);

      // Sender TON balance should be increased
      await checkTONBalIncrease(blockchain, sender, senderTonBalBefore);

      // Sender stTON balance should be increased
      await checkJettonBalIncrease(senderStTONWallet, senderStTONBalBefore);
    });

    it('should withdraw all in triTON pool with recipient', async () => {
      // Build withdraw payload
      const recipient = await blockchain.treasury('recipient');
      const withdrawParams: WithdrawParams = {
        mode: 'Balanced',
        pool: triTONPool.address,
        burnLpAmount: 1n * 10n ** 18n,
        queryId: 1n,
        recipient: recipient.address,
      };

      // Send withdraw
      const withdrawArgs = await torchSDK.getWithdrawPayload(sender, withdrawParams);
      await send(withdrawArgs);

      // Sender TriTON balance should be decreased
      await checkJettonBalDecrease(senderTriTONWallet, senderTriTONBalBefore);

      // Recipient tsTON balance should be increased
      const recipientTsTONWallet = blockchain.openContract(
        JettonWallet.create(await tsTON.getWalletAddress(recipient.address)),
      );
      await checkJettonBalIncrease(recipientTsTONWallet, 0n);

      // Recipient TON balance should be increased
      await checkTONBalIncrease(blockchain, recipient.address, 0n);

      // Recipient stTON balance should be increased
      const recipientStTONWallet = blockchain.openContract(
        JettonWallet.create(await stTON.getWalletAddress(recipient.address)),
      );
      await checkJettonBalIncrease(recipientStTONWallet, 0n);
    });

    it('should withdraw one in triTON pool', async () => {
      // Build withdraw payload
      const withdrawParams: WithdrawParams = {
        mode: 'Single',
        pool: triTONPool.address,
        burnLpAmount: 1n * 10n ** 18n,
        queryId: 1n,
        withdrawAsset: PoolAssets.tsTONAsset,
      };

      // Send withdraw
      const withdrawArgs = await torchSDK.getWithdrawPayload(sender, withdrawParams);
      await send(withdrawArgs);

      // Sender tsTON balance should be increased
      await checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore);

      // Sender TON balance should be decreased
      await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);

      // Sender stTON balance should be not changed
      await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);

      // Sender triTON balance should be decreased
      await checkJettonBalDecrease(senderTriTONWallet, senderTriTONBalBefore);
    });

    it('should withdraw one in triTON pool with recipient', async () => {
      // Build withdraw payload
      const recipient = await blockchain.treasury('recipient');
      const withdrawParams: WithdrawParams = {
        mode: 'Single',
        pool: triTONPool.address,
        burnLpAmount: 1n * 10n ** 18n,
        queryId: 1n,
        withdrawAsset: PoolAssets.tsTONAsset,
        recipient: recipient.address,
      };

      // Send withdraw
      const withdrawArgs = await torchSDK.getWithdrawPayload(sender, withdrawParams);
      await send(withdrawArgs);

      // Sender triTON balance should be decreased
      await checkJettonBalDecrease(senderTriTONWallet, senderTriTONBalBefore);

      // Recipient tsTON balance should be increased
      const recipientTsTONWallet = blockchain.openContract(
        JettonWallet.create(await tsTON.getWalletAddress(recipient.address)),
      );
      await checkJettonBalIncrease(recipientTsTONWallet, 0n);
    });

    it('should refund triTON to sender in withdraw all when slippage is not met', async () => {
      // Build withdraw payload
      const withdrawParams: WithdrawParams = {
        mode: 'Balanced',
        pool: triTONPool.address,
        burnLpAmount: 1n * 10n ** 18n,
        queryId: 1n,
        slippageTolerance: 0.01,
      };

      // Send withdraw
      const withdrawArgs = await torchSDK.getWithdrawPayload(sender, withdrawParams);

      // Someone swap to make the price fluctuate
      await swapImpactTriTON();

      await send(withdrawArgs);

      // Sender triTON balance should not be changed
      await checkJettonBalNotChanged(senderTriTONWallet, senderTriTONBalBefore);

      // Sender tsTON balance should not be changed
      await checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore);

      // Sender stTON balance should not be changed
      await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
    });

    it('should refund triTON to sender in withdraw one when slippage is not met', async () => {
      // Build withdraw payload
      const withdrawParams: WithdrawParams = {
        mode: 'Single',
        pool: triTONPool.address,
        burnLpAmount: 1n * 10n ** 18n,
        queryId: 1n,
        slippageTolerance: 0.01,
        withdrawAsset: PoolAssets.stTONAsset,
      };

      // Send withdraw
      const withdrawArgs = await torchSDK.getWithdrawPayload(sender, withdrawParams);

      // Someone swap to make the price fluctuate
      await swapImpactTriTON();

      await send(withdrawArgs);

      // Sender triTON balance should not be changed
      await checkJettonBalNotChanged(senderTriTONWallet, senderTriTONBalBefore);

      // Sender stTON balance should not be changed
      await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
    });
  });

  describe('Withdraw and Withdraw', () => {
    describe('Withdraw all and withdraw all', () => {
      it('should withdraw all and withdraw all', async () => {
        // Build withdraw payload
        const withdrawParams: WithdrawParams = {
          mode: 'Balanced',
          pool: quaTONPool.address,
          burnLpAmount: 1n * 10n ** 18n,
          queryId: 1n,
          nextWithdraw: {
            pool: triTONPool.address,
            mode: 'Balanced',
          },
        };

        // Send withdraw
        const withdrawArgs = await torchSDK.getWithdrawPayload(sender, withdrawParams);
        await send(withdrawArgs);

        // Sender QuaTON balance should be decreased
        await checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore);

        // Sender hTON balance should be increased
        await checkJettonBalIncrease(senderHTONWallet, senderHTONBalBefore);

        // Sender TON balance should be increased
        await checkJettonBalIncrease(senderHTONWallet, senderHTONBalBefore);

        // Sender stTON balance should be increased
        await checkJettonBalIncrease(senderStTONWallet, senderStTONBalBefore);

        // Sender tsTON balance should be increased
        await checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore);
      });

      it('should withdraw all and withdraw all with recipient', async () => {
        // Build withdraw payload
        const recipient = await blockchain.treasury('recipient');
        const withdrawParams: WithdrawParams = {
          mode: 'Balanced',
          pool: quaTONPool.address,
          burnLpAmount: 1n * 10n ** 18n,
          queryId: 1n,
          nextWithdraw: {
            pool: triTONPool.address,
            mode: 'Balanced',
          },
          recipient: recipient.address,
        };

        // Send withdraw
        const withdrawArgs = await torchSDK.getWithdrawPayload(sender, withdrawParams);
        await send(withdrawArgs);

        // Sender QuaTON balance should be decreased
        await checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore);

        // Recipient hTON balance should be increased
        const recipientHTONWallet = blockchain.openContract(
          JettonWallet.create(await hTON.getWalletAddress(recipient.address)),
        );
        await checkJettonBalIncrease(recipientHTONWallet, 0n);

        // Recipient TON balance should be increased
        await checkTONBalIncrease(blockchain, recipient.address, 0n);

        // Recipient stTON balance should be increased
        const recipientStTONWallet = blockchain.openContract(
          JettonWallet.create(await stTON.getWalletAddress(recipient.address)),
        );
        await checkJettonBalIncrease(recipientStTONWallet, 0n);

        // Recipient tsTON balance should be increased
        const recipientTsTONWallet = blockchain.openContract(
          JettonWallet.create(await tsTON.getWalletAddress(recipient.address)),
        );
        await checkJettonBalIncrease(recipientTsTONWallet, 0n);
      });

      it('should refund quaTON to sender in withdraw all and withdraw all when slippage is not met', async () => {
        // Build withdraw payload
        const withdrawParams: WithdrawParams = {
          mode: 'Balanced',
          pool: quaTONPool.address,
          burnLpAmount: 1n * 10n ** 18n,
          queryId: 1n,
          nextWithdraw: {
            pool: triTONPool.address,
            mode: 'Balanced',
          },
          slippageTolerance: 0.01,
        };

        // Send withdraw
        const withdrawArgs = await torchSDK.getWithdrawPayload(sender, withdrawParams);

        // Someone swap to make the price fluctuate
        await swapImpactQuaTON();

        await send(withdrawArgs);

        // Sender QuaTON balance should not be changed
        await checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore);

        // Sender hTON balance should not be changed
        await checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore);

        // Sender stTON balance should not be changed
        await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);

        // Sender tsTON balance should not be changed
        await checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore);

        // Sender TON balance should only decrease by gas fee
        await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
      });

      it('should refund triTON to sender in withdraw all and withdraw all when slippage is not met', async () => {
        // Build withdraw payload
        const burnLpAmount = 1n * 10n ** 18n;
        const withdrawParams: WithdrawParams = {
          mode: 'Balanced',
          pool: quaTONPool.address,
          burnLpAmount,
          queryId: 1n,
          nextWithdraw: {
            pool: triTONPool.address,
            mode: 'Balanced',
          },
          slippageTolerance: 0.01,
        };

        // Send withdraw
        const withdrawArgs = await torchSDK.getWithdrawPayload(sender, withdrawParams);

        // Someone swap to make the price fluctuate
        await swapImpactTriTON();

        await send(withdrawArgs);

        // Sender QuaTON balance should be decreased
        await checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, burnLpAmount);

        // Sender hTON balance should be increased
        await checkJettonBalIncrease(senderHTONWallet, senderHTONBalBefore);

        // Sender triTON balance should be increased
        await checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore);
      });
    });

    describe('Withdraw one and withdraw one', () => {
      it('should withdraw one and withdraw one', async () => {
        // Build withdraw payload
        const burnLpAmount = 1n * 10n ** 18n;
        const withdrawParams: WithdrawParams = {
          mode: 'Single',
          pool: quaTONPool.address,
          burnLpAmount,
          queryId: 1n,
          nextWithdraw: {
            pool: triTONPool.address,
            mode: 'Single',
            withdrawAsset: PoolAssets.tsTONAsset,
          },
        };

        // Send withdraw
        const withdrawArgs = await torchSDK.getWithdrawPayload(sender, withdrawParams);
        await send(withdrawArgs);

        // Sender QuaTON balance should be decreased
        await checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, burnLpAmount);

        // Sender tsTON balance should be increased
        await checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore);
      });
    });
  });
});
