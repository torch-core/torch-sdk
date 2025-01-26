import { Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { TorchSDK, WithdrawParams } from '../src';
import { initialize } from './setup';
import { PoolAssets } from './config';
import { Address, SenderArguments, toNano } from '@ton/core';
import { JettonMaster, JettonWallet } from '@ton/ton';
import {
  checkJettonBalDecrease,
  checkJettonBalIncrease,
  checkJettonBalNotChanged,
  checkTONBalDecrease,
  checkTONBalIncrease,
} from './helper/check';
import { Pool } from '@torch-finance/dex-contract-wrapper';
import { Asset } from '@torch-finance/core';

describe('Withdraw Testcases (Faster)', () => {
  // set timeout: 6 minutes
  jest.setTimeout(360000);

  let torchSDK: TorchSDK;
  let sender: Address;
  let recipient: SandboxContract<TreasuryContract>;
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

  // Recipient Jetton Wallet
  let recipientStTONWallet: SandboxContract<JettonWallet>;
  let recipientTsTONWallet: SandboxContract<JettonWallet>;
  let recipientHTONWallet: SandboxContract<JettonWallet>;
  let recipientTriTONWallet: SandboxContract<JettonWallet>;

  // Sender Asset Balance Before
  let senderTonBalBefore: bigint;
  let senderStTONBalBefore: bigint;
  let senderTsTONBalBefore: bigint;
  let senderTriTONBalBefore: bigint;
  let senderQuaTONBalBefore: bigint;
  let senderHTONBalBefore: bigint;

  // Send function
  let send: (args: SenderArguments[] | SenderArguments) => Promise<void>;
  let swapImpactTriTON: (assetIn?: Asset, assetOut?: Asset, amountIn?: bigint) => Promise<void>;
  let swapImpactQuaTON: (assetIn?: Asset, assetOut?: Asset, amountIn?: bigint) => Promise<void>;

  let blockNumber: number;

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
      swapImpactTriTON,
      swapImpactQuaTON,
      blockNumber,
    } = await initialize());
    recipient = await blockchain.treasury('recipient');

    [recipientStTONWallet, recipientTsTONWallet, recipientHTONWallet, recipientTriTONWallet] = await Promise.all([
      blockchain.openContract(JettonWallet.create(await stTON.getWalletAddress(recipient.address))),
      blockchain.openContract(JettonWallet.create(await tsTON.getWalletAddress(recipient.address))),
      blockchain.openContract(JettonWallet.create(await hTON.getWalletAddress(recipient.address))),
      blockchain.openContract(JettonWallet.create(await triTONPool.getWalletAddress(recipient.address))),
    ]);

    initBlockchainState = blockchain.snapshot();
  });

  beforeEach(async () => {
    // Reset blockchain state
    await blockchain.loadFrom(initBlockchainState);

    // Get sender balance
    [
      senderTonBalBefore,
      senderStTONBalBefore,
      senderTsTONBalBefore,
      senderHTONBalBefore,
      senderTriTONBalBefore,
      senderQuaTONBalBefore,
    ] = await Promise.all([
      blockchain.getContract(sender).then((contract) => contract.balance),
      senderStTONWallet.getBalance(),
      senderTsTONWallet.getBalance(),
      senderHTONWallet.getBalance(),
      senderTriTONWallet.getBalance(),
      senderQuaTONWallet.getBalance(),
    ]);
  });

  function createWithdrawTests(
    description: string,
    getPayload: (
      sdk: TorchSDK,
      params: WithdrawParams,
      sender: Address,
    ) => Promise<SenderArguments[] | SenderArguments>,
  ) {
    describe(description, () => {
      describe('Withdraw in TriTON Pool', () => {
        it('should withdraw all in triTON pool', async () => {
          const withdrawParams: WithdrawParams = {
            mode: 'Balanced',
            pool: triTONPool.address,
            burnLpAmount: 1n * 10n ** 18n,
            queryId: 1n,
          };

          // 使用傳入的 getPayload 函數取得 payload
          const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
          await send(withdrawArgs);

          await Promise.all([
            // Sender TriTON balance should be decreased
            checkJettonBalDecrease(senderTriTONWallet, senderTriTONBalBefore),
            // Sender tsTON balance should be increased
            checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore),
            // Sender TON balance should be increased
            checkTONBalIncrease(blockchain, sender, senderTonBalBefore),
            // Sender stTON balance should be increased
            checkJettonBalIncrease(senderStTONWallet, senderStTONBalBefore),
          ]);
        });

        it('should withdraw all in triTON pool with recipient', async () => {
          const withdrawParams: WithdrawParams = {
            mode: 'Balanced',
            pool: triTONPool.address,
            burnLpAmount: 1n * 10n ** 18n,
            queryId: 1n,
            recipient: recipient.address,
          };

          const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
          await send(withdrawArgs);

          await Promise.all([
            // Sender TriTON balance should be decreased
            checkJettonBalDecrease(senderTriTONWallet, senderTriTONBalBefore),
            // Recipient tsTON balance should be increased
            checkJettonBalIncrease(recipientTsTONWallet, 0n),
            // Recipient TON balance should be increased
            checkTONBalIncrease(blockchain, recipient.address, 0n),
            // Recipient stTON balance should be increased
            checkJettonBalIncrease(recipientStTONWallet, 0n),
          ]);
        });

        it('should withdraw one in triTON pool', async () => {
          const withdrawParams: WithdrawParams = {
            mode: 'Single',
            pool: triTONPool.address,
            burnLpAmount: 1n * 10n ** 18n,
            queryId: 1n,
            withdrawAsset: PoolAssets.TS_TON_ASSET,
          };

          const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
          await send(withdrawArgs);

          await Promise.all([
            // Sender tsTON balance should be increased
            checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore),
            // Sender TON balance should be decreased
            checkTONBalDecrease(blockchain, sender, senderTonBalBefore),
            // Sender stTON balance should be not changed
            checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
            // Sender triTON balance should be decreased
            checkJettonBalDecrease(senderTriTONWallet, senderTriTONBalBefore),
          ]);
        });

        it('should withdraw one in triTON pool with recipient', async () => {
          const withdrawParams: WithdrawParams = {
            mode: 'Single',
            pool: triTONPool.address,
            burnLpAmount: 1n * 10n ** 18n,
            queryId: 1n,
            withdrawAsset: PoolAssets.TS_TON_ASSET,
            recipient: recipient.address,
          };

          const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
          await send(withdrawArgs);

          await Promise.all([
            // Sender triTON balance should be decreased
            checkJettonBalDecrease(senderTriTONWallet, senderTriTONBalBefore),
            // Recipient tsTON balance should be increased
            checkJettonBalIncrease(recipientTsTONWallet, 0n),
          ]);
        });

        it('should refund triTON to sender in withdraw all when slippage is not met', async () => {
          const withdrawParams: WithdrawParams = {
            mode: 'Balanced',
            pool: triTONPool.address,
            burnLpAmount: 1n * 10n ** 18n,
            queryId: 1n,
            slippageTolerance: 0.01,
          };

          await swapImpactTriTON();

          // Reset balance
          senderStTONBalBefore = await senderStTONWallet.getBalance();
          senderTsTONBalBefore = await senderTsTONWallet.getBalance();

          const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
          await send(withdrawArgs);

          await Promise.all([
            // Sender triTON balance should not be changed
            checkJettonBalNotChanged(senderTriTONWallet, senderTriTONBalBefore),
            // Sender tsTON balance should not be changed
            checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore),
            // Sender stTON balance should not be changed
            checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
          ]);
        });

        it('should refund triTON to sender in withdraw one when slippage is not met', async () => {
          const withdrawParams: WithdrawParams = {
            mode: 'Single',
            pool: triTONPool.address,
            burnLpAmount: 1n * 10n ** 18n,
            queryId: 1n,
            slippageTolerance: 0.01,
            withdrawAsset: PoolAssets.ST_TON_ASSET,
          };

          await swapImpactTriTON(PoolAssets.TS_TON_ASSET, PoolAssets.ST_TON_ASSET, toNano('5'));

          // Reset balance
          senderStTONBalBefore = await senderStTONWallet.getBalance();
          senderTsTONBalBefore = await senderTsTONWallet.getBalance();

          const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
          await send(withdrawArgs);

          await Promise.all([
            // Sender triTON balance should not be changed
            checkJettonBalNotChanged(senderTriTONWallet, senderTriTONBalBefore),
            // Sender stTON balance should not be changed
            checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
          ]);
        });
      });

      describe('Withdraw and Withdraw', () => {
        describe('Withdraw all and withdraw all', () => {
          it('should withdraw all and withdraw all', async () => {
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

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore),
              // Sender hTON balance should be increased
              checkJettonBalIncrease(senderHTONWallet, senderHTONBalBefore),
              // Sender TON balance should be increased
              checkTONBalIncrease(blockchain, sender, senderTonBalBefore),
              // Sender stTON balance should be increased
              checkJettonBalIncrease(senderStTONWallet, senderStTONBalBefore),
              // Sender tsTON balance should be increased
              checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore),
            ]);
          });

          it('should withdraw all and withdraw all with recipient', async () => {
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

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore),
              // Recipient hTON balance should be increased
              checkJettonBalIncrease(recipientHTONWallet, 0n),
              // Recipient TON balance should be increased
              checkTONBalIncrease(blockchain, recipient.address, 0n),

              // Recipient stTON balance should be increased
              checkJettonBalIncrease(recipientStTONWallet, 0n),
              // Recipient tsTON balance should be increased
              checkJettonBalIncrease(recipientTsTONWallet, 0n),
            ]);
          });

          it('should refund quaTON to sender in withdraw all and withdraw all when slippage is not met', async () => {
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

            await swapImpactQuaTON();

            // Reset balance
            senderTriTONBalBefore = await senderTriTONWallet.getBalance();
            senderHTONBalBefore = await senderHTONWallet.getBalance();

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should not be changed
              checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore),

              // Sender hTON balance should not be changed
              checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore),

              // Sender stTON balance should not be changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),

              // Sender tsTON balance should not be changed
              checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore),

              // Sender TON balance should only decrease by gas fee
              checkTONBalDecrease(blockchain, sender, senderTonBalBefore),
            ]);
          });

          it('should refund triTON to sender in withdraw all and withdraw all when slippage is not met', async () => {
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

            await swapImpactTriTON();

            // Reset balance
            senderStTONBalBefore = await senderStTONWallet.getBalance();
            senderTsTONBalBefore = await senderTsTONWallet.getBalance();

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, burnLpAmount),

              // Sender hTON balance should be increased
              checkJettonBalIncrease(senderHTONWallet, senderHTONBalBefore),

              // Sender triTON balance should be increased
              checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore),
            ]);
          });
        });

        describe('Withdraw one and withdraw one', () => {
          it('should withdraw one and withdraw one', async () => {
            const burnLpAmount = 1n * 10n ** 18n;
            const withdrawParams: WithdrawParams = {
              mode: 'Single',
              pool: quaTONPool.address,
              burnLpAmount,
              queryId: 1n,
              nextWithdraw: {
                pool: triTONPool.address,
                mode: 'Single',
                withdrawAsset: PoolAssets.TS_TON_ASSET,
              },
            };

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, burnLpAmount),

              // Sender tsTON balance should be increased
              checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore),
            ]);
          });

          it('should withdraw one and withdraw one with recipient', async () => {
            const burnLpAmount = 1n * 10n ** 18n;
            const withdrawParams: WithdrawParams = {
              mode: 'Single',
              pool: quaTONPool.address,
              burnLpAmount,
              queryId: 1n,
              nextWithdraw: {
                pool: triTONPool.address,
                mode: 'Single',
                withdrawAsset: PoolAssets.TS_TON_ASSET,
              },
              recipient: recipient.address,
            };

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, burnLpAmount),

              // Recipient tsTON balance should be increased
              checkJettonBalIncrease(recipientTsTONWallet, 0n),
            ]);
          });

          it('should refund quaTON to sender in withdraw one and withdraw one when slippage is not met', async () => {
            const burnLpAmount = 1n * 10n ** 18n;
            const withdrawParams: WithdrawParams = {
              mode: 'Single',
              pool: quaTONPool.address,
              burnLpAmount,
              queryId: 1n,
              nextWithdraw: {
                pool: triTONPool.address,
                mode: 'Single',
                withdrawAsset: PoolAssets.TS_TON_ASSET,
              },
              slippageTolerance: 0.01,
            };

            await swapImpactQuaTON(PoolAssets.HTON_ASSET, PoolAssets.TRI_TON_ASSET, toNano('1'));

            // Reset balance
            senderTriTONBalBefore = await senderTriTONWallet.getBalance();
            senderHTONBalBefore = await senderHTONWallet.getBalance();

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should not be changed
              checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore),

              // Sender hTON balance should not be changed
              checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore),

              // Sender stTON balance should not be changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
            ]);
          });

          it('should refund triTON to sender in withdraw one and withdraw one when slippage is not met', async () => {
            const burnLpAmount = 1n * 10n ** 18n;
            const withdrawParams: WithdrawParams = {
              mode: 'Single',
              pool: quaTONPool.address,
              burnLpAmount,
              queryId: 1n,
              nextWithdraw: {
                pool: triTONPool.address,
                mode: 'Single',
                withdrawAsset: PoolAssets.ST_TON_ASSET,
              },
              slippageTolerance: 0.01,
            };

            await swapImpactTriTON(PoolAssets.TS_TON_ASSET, PoolAssets.ST_TON_ASSET, toNano('5'));

            // Reset balance
            senderStTONBalBefore = await senderStTONWallet.getBalance();
            senderTsTONBalBefore = await senderTsTONWallet.getBalance();

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, burnLpAmount),

              // Sender triTON balance should be increased
              checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore),

              // Sender stTON balance should be not changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
            ]);
          });
        });

        describe('Withdraw all and withdraw one', () => {
          it('should withdraw all and withdraw one', async () => {
            const burnLpAmount = 1n * 10n ** 18n;
            const withdrawParams: WithdrawParams = {
              mode: 'Balanced',
              pool: quaTONPool.address,
              burnLpAmount,
              queryId: 1n,
              nextWithdraw: {
                pool: triTONPool.address,
                mode: 'Single',
                withdrawAsset: PoolAssets.ST_TON_ASSET,
              },
            };

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, burnLpAmount),

              // Sender hTON balance should be increased
              checkJettonBalIncrease(senderHTONWallet, senderHTONBalBefore),

              // Sender stTON balance should be increased
              checkJettonBalIncrease(senderStTONWallet, senderStTONBalBefore),
            ]);
          });

          it('should withdraw all and withdraw one with recipient', async () => {
            const burnLpAmount = 1n * 10n ** 18n;
            const withdrawParams: WithdrawParams = {
              mode: 'Balanced',
              pool: quaTONPool.address,
              burnLpAmount,
              queryId: 1n,
              nextWithdraw: {
                pool: triTONPool.address,
                mode: 'Single',
                withdrawAsset: PoolAssets.ST_TON_ASSET,
              },
              recipient: recipient.address,
            };

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, burnLpAmount),

              // Recipient stTON balance should be increased
              checkJettonBalIncrease(recipientStTONWallet, 0n),

              // Recipient hTON balance should be increased
              checkJettonBalIncrease(recipientHTONWallet, 0n),
            ]);
          });

          it('should refund quaTON to sender in withdraw all and withdraw one when slippage is not met', async () => {
            const burnLpAmount = 1n * 10n ** 18n;
            const withdrawParams: WithdrawParams = {
              mode: 'Balanced',
              pool: quaTONPool.address,
              burnLpAmount,
              queryId: 1n,
              nextWithdraw: {
                pool: triTONPool.address,
                mode: 'Single',
                withdrawAsset: PoolAssets.ST_TON_ASSET,
              },
              slippageTolerance: 0.01,
            };

            await swapImpactQuaTON();

            // Reset balance
            senderTriTONBalBefore = await senderTriTONWallet.getBalance();
            senderHTONBalBefore = await senderHTONWallet.getBalance();

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should not be changed
              checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore),

              // Sender hTON balance should not be changed
              checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore),

              // Sender stTON balance should not be changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
            ]);
          });

          it('should refund triTON to sender in withdraw all and withdraw one when slippage is not met', async () => {
            const burnLpAmount = 1n * 10n ** 18n;
            const withdrawParams: WithdrawParams = {
              mode: 'Balanced',
              pool: quaTONPool.address,
              burnLpAmount,
              queryId: 1n,
              nextWithdraw: {
                pool: triTONPool.address,
                mode: 'Single',
                withdrawAsset: PoolAssets.ST_TON_ASSET,
              },
              slippageTolerance: 0.01,
            };

            await swapImpactTriTON(PoolAssets.TS_TON_ASSET, PoolAssets.ST_TON_ASSET, toNano('5'));

            // Reset balance
            senderStTONBalBefore = await senderStTONWallet.getBalance();
            senderTsTONBalBefore = await senderTsTONWallet.getBalance();

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, burnLpAmount),

              // Sender triTON balance should be increased
              checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore),

              // Sender hTON balance should be increased
              checkJettonBalIncrease(senderHTONWallet, senderHTONBalBefore),

              // Sender stTON balance should be not changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
            ]);
          });
        });

        describe('Withdraw one and withdraw all', () => {
          it('should withdraw one and withdraw all', async () => {
            const burnLpAmount = 1n * 10n ** 18n;
            const withdrawParams: WithdrawParams = {
              mode: 'Single',
              pool: quaTONPool.address,
              burnLpAmount,
              queryId: 1n,
              nextWithdraw: {
                pool: triTONPool.address,
                mode: 'Balanced',
              },
            };

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, burnLpAmount),

              // Sender hTON balance should not be changed
              checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore),

              // Sender TriTON balance should not be changed
              checkJettonBalNotChanged(senderTriTONWallet, senderTriTONBalBefore),

              // Sender stTON balance should be increased
              checkJettonBalIncrease(senderStTONWallet, senderStTONBalBefore),

              // Sender tsTON balance should be increased
              checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore),

              // Sender TON balance should be increased
              checkTONBalIncrease(blockchain, sender, senderTonBalBefore),
            ]);
          });

          it('should withdraw one and withdraw all with recipient', async () => {
            const burnLpAmount = 1n * 10n ** 18n;
            const withdrawParams: WithdrawParams = {
              mode: 'Single',
              pool: quaTONPool.address,
              burnLpAmount,
              queryId: 1n,
              nextWithdraw: {
                pool: triTONPool.address,
                mode: 'Balanced',
              },
              recipient: recipient.address,
            };

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, burnLpAmount),

              // Recipient hTON balance should not be changed
              checkJettonBalNotChanged(recipientHTONWallet, 0n),

              // Recipient stTON balance should be increased
              checkJettonBalIncrease(recipientStTONWallet, 0n),

              // Recipient TriTON balance should not be changed
              checkJettonBalNotChanged(recipientTriTONWallet, 0n),

              // Recipient tsTON balance should be increased
              checkJettonBalIncrease(recipientTsTONWallet, 0n),

              // Recipient TON balance should be increased
              checkTONBalIncrease(blockchain, recipient.address, 0n),
            ]);
          });

          it('should refund quaTON to sender in withdraw one and withdraw all when slippage is not met', async () => {
            const burnLpAmount = 1n * 10n ** 18n;
            const withdrawParams: WithdrawParams = {
              mode: 'Single',
              pool: quaTONPool.address,
              burnLpAmount,
              queryId: 1n,
              nextWithdraw: {
                pool: triTONPool.address,
                mode: 'Balanced',
              },
              slippageTolerance: 0.01,
            };

            await swapImpactQuaTON(PoolAssets.HTON_ASSET, PoolAssets.TRI_TON_ASSET, toNano('1'));

            // Reset balance
            senderTriTONBalBefore = await senderTriTONWallet.getBalance();
            senderHTONBalBefore = await senderHTONWallet.getBalance();

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should not be changed
              checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore),

              // Sender hTON balance should not be changed
              checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore),

              // Sender stTON balance should not be changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),

              // Sender tsTON balance should not be changed
              checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore),
            ]);
          });

          it('should refund triTON to sender in withdraw one and withdraw all when slippage is not met', async () => {
            const burnLpAmount = 1n * 10n ** 18n;
            const withdrawParams: WithdrawParams = {
              mode: 'Single',
              pool: quaTONPool.address,
              burnLpAmount,
              queryId: 1n,
              nextWithdraw: {
                pool: triTONPool.address,
                mode: 'Balanced',
              },
              slippageTolerance: 0.01,
            };

            await swapImpactTriTON();

            // Reset balance
            senderStTONBalBefore = await senderStTONWallet.getBalance();
            senderTsTONBalBefore = await senderTsTONWallet.getBalance();

            const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
            await send(withdrawArgs);

            await Promise.all([
              // Sender QuaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, burnLpAmount),

              // Sender hTON balance should not be changed
              checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore),

              // Sender triTON balance should be increased
              checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore),

              // Sender stTON balance should not be changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),

              // Sender tsTON balance should not be changed
              checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore),

              // Sender TON balance should only decreased by gas fee
              checkTONBalDecrease(blockchain, sender, senderTonBalBefore),
            ]);
          });
        });
      });
    });
  }

  // createWithdrawTests('Withdraw Tests', async (sdk, params, sender) => {
  //   const simulateResponse = await sdk.simulateWithdraw(params);
  //   return await simulateResponse.getWithdrawPayload(sender, { blockNumber });
  // });

  createWithdrawTests('Withdraw Tests 123', async (sdk, params, sender) => {
    return await sdk.getWithdrawPayload(sender, params, { blockNumber });
  });
});
