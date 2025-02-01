import { Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { TorchSDK, toUnit, WithdrawParams } from '../src';
import { initialize } from './helper/setup';
import { Decimals, PoolAssets } from './helper/config';
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
  let triUSDPool: SandboxContract<Pool>;
  let quaUSDPool: SandboxContract<Pool>;

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
  let senderUSDTWallet: SandboxContract<JettonWallet>;
  let senderUSDCWallet: SandboxContract<JettonWallet>;
  let senderCrvUSDWallet: SandboxContract<JettonWallet>;
  let senderScrvUSDWallet: SandboxContract<JettonWallet>;
  let senderTriUSDWallet: SandboxContract<JettonWallet>;
  let senderQuaUSDWallet: SandboxContract<JettonWallet>;

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
  let senderUSDTBalBefore: bigint;
  let senderUSDCBalBefore: bigint;
  let senderCRVUSDBalBefore: bigint;
  let senderSCRVUSDBalBefore: bigint;
  let senderTriUSDBalBefore: bigint;
  let senderQuaUSDBalBefore: bigint;

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
      triUSDPool,
      quaUSDPool,
      senderStTONWallet,
      senderTsTONWallet,
      senderHTONWallet,
      senderTriTONWallet,
      senderQuaTONWallet,
      senderUSDTWallet,
      senderUSDCWallet,
      senderCrvUSDWallet,
      senderScrvUSDWallet,
      senderTriUSDWallet,
      senderQuaUSDWallet,
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
      senderUSDTBalBefore,
      senderUSDCBalBefore,
      senderCRVUSDBalBefore,
      senderSCRVUSDBalBefore,
      senderTriUSDBalBefore,
      senderQuaUSDBalBefore,
    ] = await Promise.all([
      blockchain.getContract(sender).then((contract) => contract.balance),
      senderStTONWallet.getBalance(),
      senderTsTONWallet.getBalance(),
      senderHTONWallet.getBalance(),
      senderTriTONWallet.getBalance(),
      senderQuaTONWallet.getBalance(),
      senderUSDTWallet.getBalance(),
      senderUSDCWallet.getBalance(),
      senderCrvUSDWallet.getBalance(),
      senderScrvUSDWallet.getBalance(),
      senderTriUSDWallet.getBalance(),
      senderQuaUSDWallet.getBalance(),
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

          // Get withdraw payload
          const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);

          // Send withdraw
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
            withdrawAsset: PoolAssets.TS_TON,
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
            withdrawAsset: PoolAssets.TS_TON,
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
            withdrawAsset: PoolAssets.ST_TON,
          };

          await swapImpactTriTON(PoolAssets.TS_TON, PoolAssets.ST_TON, toNano('50'));

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

      describe('Withdraw and Withdraw in QuaTON Pool and TriTON Pool', () => {
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
                withdrawAsset: PoolAssets.TS_TON,
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
                withdrawAsset: PoolAssets.TS_TON,
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
                withdrawAsset: PoolAssets.TS_TON,
              },
              slippageTolerance: 0.01,
            };

            await swapImpactQuaTON(PoolAssets.H_TON, PoolAssets.TRI_TON, toNano('45'));

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
                withdrawAsset: PoolAssets.ST_TON,
              },
              slippageTolerance: 0.01,
            };

            await swapImpactTriTON(PoolAssets.TS_TON, PoolAssets.ST_TON, toNano('50'));

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
                withdrawAsset: PoolAssets.ST_TON,
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
                withdrawAsset: PoolAssets.ST_TON,
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
                withdrawAsset: PoolAssets.ST_TON,
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
                withdrawAsset: PoolAssets.ST_TON,
              },
              slippageTolerance: 0.01,
            };

            await swapImpactTriTON(PoolAssets.TS_TON, PoolAssets.ST_TON, toNano('50'));

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

            await swapImpactQuaTON(PoolAssets.H_TON, PoolAssets.TRI_TON, toNano('45'));

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

      describe('Withdraw in TriUSDPool', () => {
        it('should withdraw all in triUSDPool', async () => {
          // Build withdraw payload
          const withdrawParams: WithdrawParams = {
            mode: 'Balanced',
            pool: triUSDPool.address,
            burnLpAmount: toUnit(2, Decimals.TRI_USD),
            queryId: 1n,
          };

          // Get withdraw payload
          const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);

          // Send withdraw
          await send(withdrawArgs);

          await Promise.all([
            // Check sender USDT balance should be increased
            checkJettonBalIncrease(senderUSDTWallet, senderUSDTBalBefore),

            // Check sender USDC balance should be increased
            checkJettonBalIncrease(senderUSDCWallet, senderUSDCBalBefore),

            // Check sender CRVUSD balance should be increased
            checkJettonBalIncrease(senderCrvUSDWallet, senderCRVUSDBalBefore),

            // Check sender TriUSD Lp balance should be decreased
            checkJettonBalDecrease(senderTriUSDWallet, senderTriUSDBalBefore),
          ]);
        });

        it('should withdraw one in triUSDPool', async () => {
          // Build withdraw payload
          const withdrawParams: WithdrawParams = {
            mode: 'Single',
            pool: triUSDPool.address,
            burnLpAmount: toUnit(1, Decimals.TRI_USD),
            queryId: 1n,
            withdrawAsset: PoolAssets.USDT,
          };

          // Get withdraw payload
          const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);

          // Send withdraw
          await send(withdrawArgs);

          await Promise.all([
            // Check sender USDT balance should be increased
            checkJettonBalIncrease(senderUSDTWallet, senderUSDTBalBefore),

            // Check sender TriUSD balance should be decreased
            checkJettonBalDecrease(senderTriUSDWallet, senderTriUSDBalBefore),
          ]);
        });
      });

      describe('Withdraw and Withdraw in QuaUSD Pool and TriUSD Pool', () => {
        it('should withdraw all and withdraw all', async () => {
          const withdrawParams: WithdrawParams = {
            mode: 'Balanced',
            pool: quaUSDPool.address,
            burnLpAmount: toUnit(1, Decimals.QUA_USD),
            queryId: 1n,
            nextWithdraw: {
              pool: triUSDPool.address,
              mode: 'Balanced',
            },
          };

          const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);
          await send(withdrawArgs);

          await Promise.all([
            // Sender QuaUSD balance should be decreased
            checkJettonBalDecrease(senderQuaUSDWallet, senderQuaUSDBalBefore),

            // Sender TriUSD balance should be not changed
            checkJettonBalNotChanged(senderTriUSDWallet, senderTriUSDBalBefore),

            // Sender SCRV_USD balance should be increased
            checkJettonBalIncrease(senderScrvUSDWallet, senderSCRVUSDBalBefore),

            // Sender USDT balance should be increased
            checkJettonBalIncrease(senderUSDTWallet, senderUSDTBalBefore),

            // Sender USDC balance should be increased
            checkJettonBalIncrease(senderUSDCWallet, senderUSDCBalBefore),

            // Sender CRVUSD balance should be increased
            checkJettonBalIncrease(senderCrvUSDWallet, senderCRVUSDBalBefore),
          ]);
        });

        it('should withdraw all and withdraw one', async () => {
          const withdrawParams: WithdrawParams = {
            mode: 'Balanced',
            pool: quaUSDPool.address,
            burnLpAmount: toUnit(1, Decimals.QUA_USD),
            queryId: 1n,
            nextWithdraw: {
              pool: triUSDPool.address,
              mode: 'Single',
              withdrawAsset: PoolAssets.USDT,
            },
          };

          // Get withdraw payload
          const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);

          // Send withdraw
          await send(withdrawArgs);

          await Promise.all([
            // Sender QuaUSD balance should be decreased
            checkJettonBalDecrease(senderQuaUSDWallet, senderQuaUSDBalBefore),

            // Sender TriUSD balance should be not changed
            checkJettonBalNotChanged(senderTriUSDWallet, senderTriUSDBalBefore),

            // Sender SCRV_USD balance should be increased
            checkJettonBalIncrease(senderScrvUSDWallet, senderSCRVUSDBalBefore),

            // Sender USDT balance should be increased
            checkJettonBalIncrease(senderUSDTWallet, senderUSDTBalBefore),
          ]);
        });

        it('should withdraw one and withdraw all', async () => {
          const withdrawParams: WithdrawParams = {
            mode: 'Single',
            pool: quaUSDPool.address,
            burnLpAmount: toUnit(1, Decimals.QUA_USD),
            queryId: 1n,
            nextWithdraw: {
              pool: triUSDPool.address,
              mode: 'Balanced',
            },
          };

          // Get withdraw payload
          const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);

          // Send withdraw
          await send(withdrawArgs);

          await Promise.all([
            // Sender QuaUSD balance should be decreased
            checkJettonBalDecrease(senderQuaUSDWallet, senderQuaUSDBalBefore),

            // Sender TriUSD balance should be not changed
            checkJettonBalNotChanged(senderTriUSDWallet, senderTriUSDBalBefore),

            // Sender USDT balance should be increased
            checkJettonBalIncrease(senderUSDTWallet, senderUSDTBalBefore),

            // Sender USDC balance should be increased
            checkJettonBalIncrease(senderUSDCWallet, senderUSDCBalBefore),

            // Sender CRVUSD balance should be increased
            checkJettonBalIncrease(senderCrvUSDWallet, senderCRVUSDBalBefore),
          ]);
        });

        it('should withdraw one and withdraw one', async () => {
          const withdrawParams: WithdrawParams = {
            mode: 'Single',
            pool: quaUSDPool.address,
            burnLpAmount: toUnit(1, Decimals.QUA_USD),
            queryId: 1n,
            nextWithdraw: {
              pool: triUSDPool.address,
              mode: 'Single',
              withdrawAsset: PoolAssets.USDT,
            },
          };

          // Get withdraw payload
          const withdrawArgs = await getPayload(torchSDK, withdrawParams, sender);

          // Send withdraw
          await send(withdrawArgs);

          await Promise.all([
            // Sender QuaUSD balance should be decreased
            checkJettonBalDecrease(senderQuaUSDWallet, senderQuaUSDBalBefore),

            // Sender TriUSD balance should be not changed
            checkJettonBalNotChanged(senderTriUSDWallet, senderTriUSDBalBefore),

            // Sender USDT balance should be increased
            checkJettonBalIncrease(senderUSDTWallet, senderUSDTBalBefore),
          ]);
        });
      });
    });
  }

  Promise.all([
    createWithdrawTests('Withdraw Tests (Simulation)', async (sdk, params, sender) => {
      const simulateResponse = await sdk.simulateWithdraw(params);
      return await simulateResponse.getWithdrawPayload(sender, { blockNumber });
    }),

    createWithdrawTests('Withdraw Tests (Direct)', async (sdk, params, sender) => {
      return await sdk.getWithdrawPayload(sender, params, { blockNumber });
    }),
  ]);
});
