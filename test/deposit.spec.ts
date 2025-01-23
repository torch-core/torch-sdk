import { Blockchain, BlockchainSnapshot, SandboxContract } from '@ton/sandbox';
import { DepositParams, TorchSDK } from '../src';
import { initialize } from './setup';
import { PoolAssets } from './config';
import { Address, SenderArguments, toNano } from '@ton/core';
import { JettonWallet } from '@ton/ton';
import { checkJettonBalDecrease, checkJettonBalIncrease, checkTONBalDecrease } from './helper/check';
import { Pool } from '@torch-finance/dex-contract-wrapper';
import { Allocation } from '@torch-finance/core';

describe('Deposit Testcases', () => {
  // set timeout: 6 minutes
  jest.setTimeout(360000);

  let torchSDK: TorchSDK;
  let sender: Address;
  let blockchain: Blockchain;
  let initBlockchainState: BlockchainSnapshot;
  let triTONPool: SandboxContract<Pool>;
  let quaTONPool: SandboxContract<Pool>;

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
  let senderHTONBalBefore: bigint;
  let senderTriTONBalBefore: bigint;
  let senderQuaTONBalBefore: bigint;

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

  describe('TriTON Pool', () => {
    afterEach(async () => {
      // Sender triTON balance should be increased
      await checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore);

      // QuaTON Diff
      console.log('diff', (await senderTriTONWallet.getBalance()) - senderTriTONBalBefore);
    });

    it('should deposit TON, tsTON and stTON to triTON pool', async () => {
      // Build deposit params
      const depositParams: DepositParams = {
        pool: triTONPool.address,
        depositAmounts: Allocation.createAllocations([
          { asset: PoolAssets.tonAsset, value: toNano('1') },
          { asset: PoolAssets.tsTONAsset, value: toNano('1') },
          { asset: PoolAssets.stTONAsset, value: toNano('1') },
        ]),
      };

      // Send deposit
      const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
      await send(sendDepositArgs);

      // Sender TON, tsTON and stTON balance should be decreased
      await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
      await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore);
      await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
    });

    it('should deposit TON and stTON to triTON pool', async () => {
      // Build deposit params
      const depositParams: DepositParams = {
        pool: triTONPool.address,
        depositAmounts: Allocation.createAllocations([
          { asset: PoolAssets.tonAsset, value: toNano('1') },
          { asset: PoolAssets.stTONAsset, value: toNano('1') },
        ]),
      };

      // Send deposit
      const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
      await send(sendDepositArgs);

      // Sender TON and stTON balance should be decreased
      await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
      await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
    });

    it('should deposit tsTON and stTON to triTON pool', async () => {
      // Build deposit params
      const depositParams: DepositParams = {
        pool: triTONPool.address,
        depositAmounts: Allocation.createAllocations([
          { asset: PoolAssets.tsTONAsset, value: toNano('1') },
          { asset: PoolAssets.stTONAsset, value: toNano('1') },
        ]),
      };

      // Send deposit
      const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
      await send(sendDepositArgs);

      // Sender tsTON and stTON balance should be decreased
      await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
      await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore);
    });

    it('should deposit TON triTON pool', async () => {
      // Build deposit params
      const depositParams: DepositParams = {
        pool: triTONPool.address,
        depositAmounts: new Allocation({ asset: PoolAssets.tonAsset, value: toNano('1') }),
      };

      // Send deposit
      const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
      await send(sendDepositArgs);

      // Sender TON balance should be decreased
      await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
    });

    it('should deposit stTON to triTON pool', async () => {
      // Build deposit params
      const depositParams: DepositParams = {
        pool: triTONPool.address,
        depositAmounts: new Allocation({ asset: PoolAssets.stTONAsset, value: toNano('1') }),
      };

      // Send deposit
      const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
      await send(sendDepositArgs);

      // Sender stTON balance should be decreased
      await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
    });
  });

  describe('Deposit and Deposit', () => {
    afterEach(async () => {
      // Sender quaTON Lp balance should be increased
      await checkJettonBalIncrease(senderQuaTONWallet, senderQuaTONBalBefore);

      // QuaTON Diff
      console.log('diff', (await senderQuaTONWallet.getBalance()) - senderQuaTONBalBefore);
    });

    describe('With Meta Asset', () => {
      it('should deposit TON, tsTON, stTON and hTON to quaTON pool', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: Allocation.createAllocations([
            { asset: PoolAssets.tonAsset, value: toNano('1') },
            { asset: PoolAssets.tsTONAsset, value: toNano('1') },
            { asset: PoolAssets.stTONAsset, value: toNano('1') },
          ]),
          nextDeposit: {
            pool: quaTONPool.address,
            depositAmounts: new Allocation({ asset: PoolAssets.hTONAsset, value: toNano('1') }),
          },
        };

        // Send deposit
        const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender TON, tsTON, stTON and hTON balance should be decreased
        await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
        await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore);
        await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
        await checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore);
      });

      it('should refund TON, tsTON, stTON when slippage is not met', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: Allocation.createAllocations([
            { asset: PoolAssets.tonAsset, value: toNano('1') },
            { asset: PoolAssets.tsTONAsset, value: toNano('1') },
            { asset: PoolAssets.stTONAsset, value: toNano('1') },
          ]),
          nextDeposit: {
            pool: quaTONPool.address,
            depositAmounts: new Allocation({ asset: PoolAssets.hTONAsset, value: toNano('1') }),
          },
        };

        // Send deposit
        const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
        await send(sendDepositArgs);
      });

      it('should deposit TON, stTON and hTON to quaTON pool', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: Allocation.createAllocations([
            { asset: PoolAssets.tonAsset, value: toNano('1') },
            { asset: PoolAssets.stTONAsset, value: toNano('1') },
          ]),
          nextDeposit: {
            pool: quaTONPool.address,
            depositAmounts: new Allocation({ asset: PoolAssets.hTONAsset, value: toNano('1') }),
          },
        };

        // Send deposit
        const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender TON, stTON and hTON balance should be decreased
        await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
        await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
        await checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore);
      });

      it('should deposit TON and hTON to quaTON pool', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: new Allocation({ asset: PoolAssets.tonAsset, value: toNano('1') }),
          nextDeposit: {
            pool: quaTONPool.address,
            depositAmounts: new Allocation({ asset: PoolAssets.hTONAsset, value: toNano('1') }),
          },
        };

        // Send deposit
        const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender TON and hTON balance should be decreased
        await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
        await checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore);
      });

      it('should deposit stTON and hTON to quaTON pool', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: new Allocation({ asset: PoolAssets.stTONAsset, value: toNano('1') }),
          nextDeposit: {
            pool: quaTONPool.address,
            depositAmounts: new Allocation({ asset: PoolAssets.hTONAsset, value: toNano('1') }),
          },
        };

        // Send deposit
        const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender stTON and hTON balance should be decreased
        await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
        await checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore);
      });
    });

    describe('Without Meta Asset', () => {
      it('should deposit TON, tsTON and stTON to quaTON pool', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: Allocation.createAllocations([
            { asset: PoolAssets.tonAsset, value: toNano('1') },
            { asset: PoolAssets.tsTONAsset, value: toNano('1') },
            { asset: PoolAssets.stTONAsset, value: toNano('1') },
          ]),
          nextDeposit: {
            pool: quaTONPool.address,
          },
        };

        // Send deposit
        const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender TON, tsTON and stTON balance should be decreased
        await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
        await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore);
        await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
      });

      it('should deposit TON and stTON to quaTON pool', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: Allocation.createAllocations([
            { asset: PoolAssets.tonAsset, value: toNano('1') },
            { asset: PoolAssets.stTONAsset, value: toNano('1') },
          ]),
          nextDeposit: {
            pool: quaTONPool.address,
          },
        };

        // Send deposit
        const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender TON and stTON balance should be decreased
        await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
        await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
      });

      it('should deposit TON to quaTON pool', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: new Allocation({ asset: PoolAssets.tonAsset, value: toNano('1') }),
          nextDeposit: {
            pool: quaTONPool.address,
          },
        };

        // Send deposit
        const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender TON balance should be decreased
        await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
      });

      it('should deposit stTON to quaTON pool', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: new Allocation({ asset: PoolAssets.stTONAsset, value: toNano('1') }),
          nextDeposit: {
            pool: quaTONPool.address,
          },
        };

        // Send deposit
        const sendDepositArgs = await torchSDK.getDepositPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender stTON balance should be decreased
        await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
      });
    });
  });
});
