import { Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { SwapParams, TorchSDK, toUnit } from '../src';
import { initialize } from './helper/setup';
import { Decimals, PoolAssets, PoolConfig } from './helper/config';
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
  let senderUSDTWallet: SandboxContract<JettonWallet>;
  let senderUSDCWallet: SandboxContract<JettonWallet>;
  let senderScrvUSDWallet: SandboxContract<JettonWallet>;
  let senderQuaUSDWallet: SandboxContract<JettonWallet>;
  // let senderStgUSDWallet: SandboxContract<JettonWallet>;

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
  let senderUSDTBalBefore: bigint;
  let senderUSDCBalBefore: bigint;
  let senderSCRVUSDBalBefore: bigint;
  let senderQuaUSDBalBefore: bigint;
  // let senderStgUSDBalBefore: bigint;

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
      quaTONPool,
      senderStTONWallet,
      senderTsTONWallet,
      senderHTONWallet,
      senderTriTONWallet,
      senderQuaTONWallet,
      senderUSDTWallet,
      senderUSDCWallet,
      senderScrvUSDWallet,
      senderQuaUSDWallet,
      // senderStgUSDWallet,
      stTON,
      tsTON,
      hTON,
      send,
      swapImpactTriTON,
      swapImpactQuaTON,
      blockNumber,
    } = await initialize());
    recipient = await blockchain.treasury('recipient');

    [recipientStTONWallet, recipientTsTONWallet, recipientHTONWallet, recipientQuaTONWallet] = await Promise.all([
      blockchain.openContract(JettonWallet.create(await stTON.getWalletAddress(sender))),
      blockchain.openContract(JettonWallet.create(await tsTON.getWalletAddress(sender))),
      blockchain.openContract(JettonWallet.create(await hTON.getWalletAddress(sender))),
      blockchain.openContract(JettonWallet.create(await quaTONPool.getWalletAddress(sender))),
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
      senderSCRVUSDBalBefore,
      senderQuaUSDBalBefore,
      // senderStgUSDBalBefore,
    ] = await Promise.all([
      blockchain.getContract(sender).then((contract) => contract.balance),
      senderStTONWallet.getBalance(),
      senderTsTONWallet.getBalance(),
      senderHTONWallet.getBalance(),
      senderTriTONWallet.getBalance(),
      senderQuaTONWallet.getBalance(),
      senderUSDTWallet.getBalance(),
      senderUSDCWallet.getBalance(),
      senderScrvUSDWallet.getBalance(),
      senderQuaUSDWallet.getBalance(),
      // senderStgUSDWallet.getBalance(),
    ]);
  });

  function createSwapTests(
    description: string,
    getPayload: (sdk: TorchSDK, params: SwapParams, sender: Address) => Promise<SenderArguments[] | SenderArguments>,
  ) {
    describe(description, () => {
      describe('Swap in TriTON Pool', () => {
        it('should swap tsTON to stTON by routes', async () => {
          const amountIn = toNano('0.05');
          const swapExactInParams: SwapParams = {
            mode: 'ExactIn',
            assetIn: PoolAssets.TS_TON,
            assetOut: PoolAssets.ST_TON,
            amountIn,
            routes: [PoolConfig.TRI_TON_POOL_ADDRESS],
          };

          // Get swap payload
          const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
          // Send swap
          await send(sendExactInArgs);

          await Promise.all([
            // Sender stTON balance should be increased
            checkJettonBalIncrease(senderStTONWallet, senderStTONBalBefore),
            // Sender tsTON balance should be decreased
            checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn),
          ]);
        });

        it('should swap tsTON to stTON (ExactIn + ExactOut)', async () => {
          // Build swap exact in payload
          const amountIn = toNano('0.05');
          const swapExactInParams: SwapParams = {
            mode: 'ExactIn',
            assetIn: PoolAssets.TS_TON,
            assetOut: PoolAssets.ST_TON,
            amountIn,
          };

          // Send swap
          const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
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
            assetIn: PoolAssets.TS_TON,
            assetOut: PoolAssets.ST_TON,
            amountOut: swapOutAmount,
          };

          // Send swap
          const sendExactOutArgs = await getPayload(torchSDK, swapExactOutParams, sender);
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
            assetIn: PoolAssets.TS_TON,
            assetOut: PoolAssets.ST_TON,
            amountIn,
            minAmountOut: toNano('1'),
          };

          // Send swap
          const sendArgs = await getPayload(torchSDK, swapParams, sender);
          await send(sendArgs);

          // Sender stTON balance should be not changed
          await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);

          // Build swap payload with slippage
          const swapSlipageParams: SwapParams = {
            mode: 'ExactIn',
            assetIn: PoolAssets.TS_TON,
            assetOut: PoolAssets.ST_TON,
            amountIn,
            slippageTolerance: 0.01,
          };

          // Someone swap to make the price fluctuate
          await swapImpactTriTON();

          // Reset balance
          senderStTONBalBefore = await senderStTONWallet.getBalance();
          senderTsTONBalBefore = await senderTsTONWallet.getBalance();

          // Send swap
          const sendSlipageArgs = await getPayload(torchSDK, swapSlipageParams, sender);
          await send(sendSlipageArgs);

          // Sender stTON balance should be not changed
          await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
        });

        it('should refund tsTON to sender when slippage not met (tsTON -> stTON ExactIn)', async () => {
          // Build swap paylaod with min amount out
          const amountIn = toNano('0.05');
          const swapParams: SwapParams = {
            mode: 'ExactIn',
            assetIn: PoolAssets.TS_TON,
            assetOut: PoolAssets.ST_TON,
            amountIn,
            slippageTolerance: 0.01,
          };

          // Send swap
          const sendArgs = await getPayload(torchSDK, swapParams, sender);

          // Someone swap to make the price fluctuate
          await swapImpactTriTON();

          // Reset balance
          senderStTONBalBefore = await senderStTONWallet.getBalance();
          senderTsTONBalBefore = await senderTsTONWallet.getBalance();

          // Send swap
          await send(sendArgs);

          // Sender stTON balance should be not changed
          await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);

          // Someone swap to make the price fluctuate
          await swapImpactTriTON();

          // Reset balance
          [senderStTONBalBefore, senderTsTONBalBefore] = await Promise.all([
            senderStTONWallet.getBalance(),
            senderTsTONWallet.getBalance(),
          ]);

          // Build swap payload with slippage
          const swapSlipageParams: SwapParams = {
            mode: 'ExactIn',
            assetIn: PoolAssets.TS_TON,
            assetOut: PoolAssets.ST_TON,
            amountIn,
            slippageTolerance: 0.01,
          };

          // Send swap
          const sendSlipageArgs = await getPayload(torchSDK, swapSlipageParams, sender);
          await send(sendSlipageArgs);

          // Sender stTON balance should be not changed
          await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
        });

        it('should refund tsTON to sender when min amount out is not met (tsTON -> stTON ExactOut)', async () => {
          // Build swap paylaod with min amount out
          const amountOut = toNano('1');
          const swapParams: SwapParams = {
            mode: 'ExactOut',
            assetIn: PoolAssets.TS_TON,
            assetOut: PoolAssets.ST_TON,
            amountOut,
            minAmountOut: toNano('1.5'),
          };

          // Send swap
          const sendArgs = await getPayload(torchSDK, swapParams, sender);
          await send(sendArgs);

          // Sender stTON balance should be not changed
          await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
        });

        it('should refund tsTON to sender when slippage not met (tsTON -> stTON ExactOut)', async () => {
          // Build swap payload with slippage
          const amountOut = toNano('1');
          const swapSlipageParams: SwapParams = {
            mode: 'ExactOut',
            assetIn: PoolAssets.TS_TON,
            assetOut: PoolAssets.ST_TON,
            amountOut,
            slippageTolerance: 0.01,
          };

          // Someone swap to make the price fluctuate
          await swapImpactTriTON();

          // Reset balance
          [senderStTONBalBefore, senderTsTONBalBefore] = await Promise.all([
            senderStTONWallet.getBalance(),
            senderTsTONWallet.getBalance(),
          ]);

          // Send swap
          const sendSlipageArgs = await getPayload(torchSDK, swapSlipageParams, sender);
          await send(sendSlipageArgs);

          // Sender stTON balance should be not changed
          await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
        });

        it('should swap TON to stTON', async () => {
          // Build swap paylaod
          const amountIn = toNano('0.05');
          const swapParams: SwapParams = {
            mode: 'ExactIn',
            assetIn: PoolAssets.TON,
            assetOut: PoolAssets.ST_TON,
            amountIn,
          };

          // Send swap
          const sendArgs = await getPayload(torchSDK, swapParams, sender);
          await send(sendArgs);

          await Promise.all([
            // Sender stTON balance should be increased
            checkJettonBalIncrease(senderStTONWallet, senderStTONBalBefore),
            // Sender TON balance should be decreased
            checkTONBalDecrease(blockchain, sender, senderTonBalBefore),
          ]);
        });

        it('should swap TON to stTON with recipient', async () => {
          // Build swap paylaod
          const amountIn = toNano('0.05');
          const swapParams: SwapParams = {
            mode: 'ExactIn',
            assetIn: PoolAssets.TON,
            assetOut: PoolAssets.ST_TON,
            amountIn,
            recipient: recipient.address,
          };

          // Send swap
          const sendArgs = await getPayload(torchSDK, swapParams, sender);
          await send(sendArgs);

          // Recipient stTON balance should be increased
          await checkJettonBalIncrease(recipientStTONWallet, 0n);
        });

        it('should swap TON to stTON with referral code', async () => {
          // Build swap paylaod
          const amountIn = toNano('0.05');
          const swapParams: SwapParams = {
            mode: 'ExactIn',
            assetIn: PoolAssets.TON,
            assetOut: PoolAssets.ST_TON,
            amountIn,
          };

          // Send swap
          const sendArgs = await torchSDK.getSwapPayload(sender, swapParams, {
            referralCode: 1n,
          });
          await send(sendArgs);

          await Promise.all([
            // Sender stTON balance should be increased
            checkJettonBalIncrease(senderStTONWallet, senderStTONBalBefore),
            // Sender TON balance should be decreased
            checkTONBalDecrease(blockchain, sender, senderTonBalBefore),
          ]);
        });
      });

      describe('Cross pool swap in TriTON Pool and QuaTON Pool', () => {
        describe('Deposit and swap', () => {
          it('should swap tsTON to hTON by routes', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapExactInParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.H_TON,
              amountIn,
              routes: [PoolConfig.TRI_TON_POOL_ADDRESS, PoolConfig.QUA_TON_POOL_ADDRESS],
            };

            // Send swap
            const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
            await send(sendExactInArgs);

            await Promise.all([
              // Sender hTON balance should be increased
              checkJettonBalIncrease(senderHTONWallet, senderHTONBalBefore),
              // Sender tsTON balance should be decreased
              checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn),
            ]);
          });

          it('should swap tsTON to hTON (ExactIn + ExactOut)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapExactInParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.H_TON,
              amountIn,
            };

            // Send swap
            const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
            await send(sendExactInArgs);

            await Promise.all([
              // Sender hTON balance should be increased
              checkJettonBalIncrease(senderHTONWallet, senderHTONBalBefore),
              // Sender tsTON balance should be decreased
              checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn),
            ]);

            // Get amount of hTON received
            const hTONBalIncrease = (await senderHTONWallet.getBalance()) - senderHTONBalBefore;

            // Restore blockchain state
            await blockchain.loadFrom(initBlockchainState);

            // Build swap payload
            const swapExactOutParams: SwapParams = {
              mode: 'ExactOut',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.H_TON,
              amountOut: hTONBalIncrease,
            };

            // Send swap
            const sendExactOutArgs = await getPayload(torchSDK, swapExactOutParams, sender);
            await send(sendExactOutArgs);

            await Promise.all([
              // Sender hTON balance should be increased
              checkJettonBalIncrease(senderHTONWallet, senderHTONBalBefore),
              // Sender tsTON balance should be decreased
              checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn),
            ]);

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
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.H_TON,
              amountIn,
              recipient: recipient.address,
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);
            await send(sendArgs);

            // Recipient hTON balance should be increased
            await checkJettonBalIncrease(recipientHTONWallet, 0n);
          });

          it('should refund tsTON to sender when min amount out is not met (tsTON -> hTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.H_TON,
              amountIn,
              minAmountOut: toNano('1'), // This is minAmountOut is too big, so it should be refunded in the first pool
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);
            await send(sendArgs);

            await Promise.all([
              // Sender hTON balance should not be changed
              checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore),
              // Sender tsTON balance should not be changed
              checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore),
            ]);
          });

          it('should refund TriTON to sender when min amount out is not met (tsTON -> hTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = toNano('5');
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.H_TON,
              amountIn,
            };

            // Simulate to get amount out
            const simulateResult = await torchSDK.simulateSwap(swapParams);
            if (simulateResult.result.mode != 'ExactIn') {
              throw new Error('Simulate result is not ExactIn');
            }

            swapParams.minAmountOut = simulateResult.result.amountOut - 10000n; // Make it can pass the first pool minAmountOut check, but not pass the second pool minAmountOut check

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);

            // Someone swap to make the price fluctuate in QuaTON pool, so that it will be refunded in the first pool
            await swapImpactQuaTON();

            // Reset balance
            [senderTriTONBalBefore, senderHTONBalBefore] = await Promise.all([
              senderTriTONWallet.getBalance(),
              senderHTONWallet.getBalance(),
            ]);

            // Send swap
            await send(sendArgs);

            await Promise.all([
              // Sender hTON balance should not be changed
              checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore),
              // Sender tsTON balance should be decreased
              checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn),
              // Sender triTON balance should be increased
              checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore),
            ]);
          });

          it('should refund tsTON to sender when slippage not met (tsTON -> hTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.H_TON,
              amountIn,
              slippageTolerance: 0.01,
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);

            // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the first pool
            await swapImpactTriTON(PoolAssets.TS_TON, PoolAssets.ST_TON, toNano('50'));

            // Reset balance
            senderStTONBalBefore = await senderStTONWallet.getBalance();
            senderTsTONBalBefore = await senderTsTONWallet.getBalance();

            // Send swap
            await send(sendArgs);

            await Promise.all([
              // Sender hTON balance should not be changed
              checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore),
              // Sender tsTON balance should not be changed
              checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore),
            ]);
          });

          it('should refund TriTON to sender when slippage not met (tsTON -> hTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.H_TON,
              amountIn,
              slippageTolerance: 0.01,
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);

            // Someone swap to make the price fluctuate in QuaTON pool, so that it will be refunded in the second pool
            await swapImpactQuaTON();

            // Reset balance
            senderTriTONBalBefore = await senderTriTONWallet.getBalance();
            senderHTONBalBefore = await senderHTONWallet.getBalance();

            // Send swap
            await send(sendArgs);

            await Promise.all([
              // Sender hTON balance should not be changed
              checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore),
              // Sender tsTON balance should be decreased
              checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn),
              // Sender triTON balance should be increased due to the refund
              checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore),
            ]);
          });
        });

        describe('Swap and Withdraw', () => {
          it('should swap hTON to tsTON by routes', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapExactInParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.H_TON,
              assetOut: PoolAssets.TS_TON,
              amountIn,
              routes: [PoolConfig.QUA_TON_POOL_ADDRESS, PoolConfig.TRI_TON_POOL_ADDRESS],
            };

            // Send swap
            const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
            await send(sendExactInArgs);

            await Promise.all([
              // Sender tsTON balance should be increased
              checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore),
              // Sender hTON balance should be decreased
              checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore, amountIn),
            ]);
          });
          it('should swap hTON to tsTON (ExactIn + ExactOut)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapExactInParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.H_TON,
              assetOut: PoolAssets.TS_TON,
              amountIn,
            };

            // Send swap
            const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
            await send(sendExactInArgs);

            await Promise.all([
              // Sender tsTON balance should be increased
              checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore),
              // Sender hTON balance should be decreased
              checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore, amountIn),
            ]);

            const expectedAmountOut = (await senderTsTONWallet.getBalance()) - senderTsTONBalBefore;

            // Restore blockchain state
            await blockchain.loadFrom(initBlockchainState);

            // Build swap payload
            const swapExactOutParams: SwapParams = {
              mode: 'ExactOut',
              assetIn: PoolAssets.H_TON,
              assetOut: PoolAssets.TS_TON,
              amountOut: expectedAmountOut,
            };

            // Send swap
            const sendExactOutArgs = await getPayload(torchSDK, swapExactOutParams, sender);
            await send(sendExactOutArgs);

            await Promise.all([
              // Sender tsTON balance should be increased
              checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore),
              // Sender hTON balance should be decreased
              checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore, amountIn),
            ]);

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
              assetIn: PoolAssets.H_TON,
              assetOut: PoolAssets.TS_TON,
              amountIn,
              recipient: recipient.address,
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);
            await send(sendArgs);

            // Recipient tsTON balance should be increased
            await checkJettonBalIncrease(recipientTsTONWallet, 0n);
          });

          it('should refund hTON to sender when min amount out is not met (hTON -> stTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.H_TON,
              assetOut: PoolAssets.ST_TON,
              amountIn,
              minAmountOut: toNano('1'), // This is minAmountOut is too big, so it should be refunded in the first pool
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);
            await send(sendArgs);

            await Promise.all([
              // Sender hTON balance should not be changed
              checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore),
              // Sender stTON balance should not be changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
            ]);
          });

          it('should refund TriTON to sender when min amount out is not met (hTON -> stTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            // Simulate to get amount out
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.H_TON,
              assetOut: PoolAssets.ST_TON,
              amountIn,
            };
            const simulateResult = await torchSDK.simulateSwap({
              mode: 'ExactIn',
              assetIn: PoolAssets.H_TON,
              assetOut: PoolAssets.ST_TON,
              amountIn,
            });

            if (simulateResult.result.mode != 'ExactIn') {
              throw new Error('Simulate result is not ExactIn');
            }

            swapParams.minAmountOut = simulateResult.result.amountOut - 100n; // Make it can pass the first pool minAmountOut check, but not pass the second pool minAmountOut check

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);

            // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the second pool
            await swapImpactTriTON();

            // Reset balance
            senderStTONBalBefore = await senderStTONWallet.getBalance();
            senderTsTONBalBefore = await senderTsTONWallet.getBalance();

            // Send swap
            await send(sendArgs);

            await Promise.all([
              // Sender hTON balance should be decreased
              checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore, amountIn),
              // Sender stTON balance should not be changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
              // Sender triTON balance should be increased
              checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore),
            ]);
          });

          it('should refund hTON to sender when slippage is not met (hTON -> stTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.H_TON,
              assetOut: PoolAssets.ST_TON,
              amountIn,
              slippageTolerance: 0.01,
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);

            // Someone swap to make the price fluctuate in QuaTON pool, so that it will be refunded in the second pool
            const swapFluctuateParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.H_TON,
              assetOut: PoolAssets.TS_TON,
              amountIn: toNano('1'),
            };
            await swapImpactQuaTON(PoolAssets.H_TON, PoolAssets.TRI_TON, toUnit(50, Decimals.HTON));
            const sendFluctuateArgs = await getPayload(torchSDK, swapFluctuateParams, sender);
            await send(sendFluctuateArgs);

            // Reset balance
            senderTriTONBalBefore = await senderTriTONWallet.getBalance();
            senderHTONBalBefore = await senderHTONWallet.getBalance();

            // Send swap
            await send(sendArgs);

            await Promise.all([
              // Sender hTON balance should not be changed
              checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore),
              // Sender stTON balance should not be changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
            ]);
          });

          it('should refund stTON to sender when slippage is not met (hTON -> stTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.H_TON,
              assetOut: PoolAssets.ST_TON,
              amountIn,
              slippageTolerance: 0.01,
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);

            // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the second pool
            await swapImpactTriTON(PoolAssets.TS_TON, PoolAssets.ST_TON, toNano('50'));

            // Reset balance
            senderStTONBalBefore = await senderStTONWallet.getBalance();
            senderTsTONBalBefore = await senderTsTONWallet.getBalance();

            // Send swap
            await send(sendArgs);

            await Promise.all([
              // Sender hTON balance should be decreased
              checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore, amountIn),
              // Sender stTON balance should not be changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
              // Sender TriTON balance should be increased
              checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore),
            ]);
          });
        });

        describe('Deposit and Deposit', () => {
          it('should swap tsTON to quaTON by routes', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapExactInParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.QUA_TON,
              amountIn,
            };

            // Send swap
            const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
            await send(sendExactInArgs);

            await Promise.all([
              // Sender tsTON balance should be decreased
              checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn),
              // Sender quaTON balance should be increased
              checkJettonBalIncrease(senderQuaTONWallet, senderQuaTONBalBefore),
            ]);
          });

          it('should swap tsTON to quaTON (ExactIn + ExactOut)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapExactInParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.QUA_TON,
              amountIn,
            };

            // Send swap
            const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
            await send(sendExactInArgs);

            await Promise.all([
              // Sender tsTON balance should be decreased
              checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn),
              // Sender quaTON balance should be increased
              checkJettonBalIncrease(senderQuaTONWallet, senderQuaTONBalBefore),
            ]);

            const expectedAmountOut = (await senderQuaTONWallet.getBalance()) - senderQuaTONBalBefore;

            // Restore blockchain state
            await blockchain.loadFrom(initBlockchainState);

            // Build swap payload
            const swapExactOutParams: SwapParams = {
              mode: 'ExactOut',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.QUA_TON,
              amountOut: expectedAmountOut,
            };

            // Send swap
            const sendExactOutArgs = await getPayload(torchSDK, swapExactOutParams, sender);
            await send(sendExactOutArgs);

            await Promise.all([
              // Sender tsTON balance should be decreased
              checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn),
              // Sender quaTON balance should be increased
              checkJettonBalIncrease(senderQuaTONWallet, senderQuaTONBalBefore),
            ]);

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
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.QUA_TON,
              amountIn,
              recipient: recipient.address,
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);
            await send(sendArgs);

            // Recipient tsTON balance should be increased
            await checkJettonBalIncrease(recipientQuaTONWallet, 0n);
          });

          it('should refund tsTON to sender when min amount out is not met (tsTON -> quaTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.QUA_TON,
              amountIn,
              minAmountOut: toUnit(1, Decimals.TRI_TON), // This is minAmountOut is too big, so it should be refunded in the first pool
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);
            await send(sendArgs);

            await Promise.all([
              // Sender tsTON balance should not be changed
              checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore),
              // Sender quaTON balance should not be changed
              checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore),
            ]);
          });

          it('should refund TriTON to sender when min amount out is not met (tsTON -> quaTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.QUA_TON,
              amountIn,
            };

            // Simulate to get amount out
            const simulateResult = await torchSDK.simulateSwap(swapParams);
            if (simulateResult.result.mode != 'ExactIn') {
              throw new Error('Simulate result is not ExactIn');
            }
            swapParams.minAmountOut = simulateResult.result.amountOut - 100n; // Make it can pass the first pool minAmountOut check, but not pass the second pool minAmountOut check

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);

            // Someone swap to make the price fluctuate in QuaTON pool, so that it will be refunded in the second pool
            await swapImpactQuaTON();

            // Reset balance
            senderTriTONBalBefore = await senderTriTONWallet.getBalance();
            senderHTONBalBefore = await senderHTONWallet.getBalance();

            // Send swap
            await send(sendArgs);

            await Promise.all([
              // Sender tsTON balance should be decreased
              checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn),
              // Sender quaTON balance should not be changed
              checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore),
              // Sender triTON balance should be increased
              checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore),
            ]);
          });

          it('should refund tsTON to sender when slippage is not met (tsTON -> quaTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.QUA_TON,
              amountIn,
              slippageTolerance: 0.01,
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);

            // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the second pool
            await swapImpactTriTON(PoolAssets.TS_TON, PoolAssets.ST_TON, toNano('50'));

            // Reset balance
            senderStTONBalBefore = await senderStTONWallet.getBalance();
            senderTsTONBalBefore = await senderTsTONWallet.getBalance();

            // Send swap
            await send(sendArgs);

            await Promise.all([
              // Sender tsTON balance should not be changed
              checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore),
              // Sender quaTON balance should not be changed
              checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore),
            ]);
          });

          it('should refund triTON to sender when slippage is not met (tsTON -> quaTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = toNano('0.05');
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.TS_TON,
              assetOut: PoolAssets.QUA_TON,
              amountIn,
              slippageTolerance: 0.01,
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);

            // Someone swap to make the price fluctuate in QuaTON pool, so that it will be refunded in the second pool
            await swapImpactQuaTON();

            // Reset balance
            senderTriTONBalBefore = await senderTriTONWallet.getBalance();
            senderHTONBalBefore = await senderHTONWallet.getBalance();

            // Send swap
            await send(sendArgs);

            await Promise.all([
              // Sender tsTON balance should be decreased
              checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore, amountIn),
              // Sender triTON balance should be increased
              checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore),
            ]);
          });
        });

        describe('Withdraw and Withdraw', () => {
          it('should swap quaTON to tsTON by routes', async () => {
            // Build swap payload
            const amountIn = 10n ** 16n;
            const swapExactInParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.QUA_TON,
              assetOut: PoolAssets.TS_TON,
              amountIn,
              routes: [PoolConfig.QUA_TON_POOL_ADDRESS, PoolConfig.TRI_TON_POOL_ADDRESS],
            };

            // Send swap
            const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
            await send(sendExactInArgs);

            await Promise.all([
              // Sender quaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, amountIn),
              // Sender tsTON balance should be increased
              checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore),
            ]);
          });
          it('should swap quaTON to tsTON (ExactIn + ExactOut)', async () => {
            // Build swap payload
            const amountIn = 10n ** 16n;
            const swapExactInParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.QUA_TON,
              assetOut: PoolAssets.TS_TON,
              amountIn,
            };

            // Send swap
            const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
            await send(sendExactInArgs);

            await Promise.all([
              // Sender quaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, amountIn),
              // Sender tsTON balance should be increased
              checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore),
            ]);

            const expectedAmountOut = (await senderTsTONWallet.getBalance()) - senderTsTONBalBefore;

            // Restore blockchain state
            await blockchain.loadFrom(initBlockchainState);

            // Build swap payload
            const swapExactOutParams: SwapParams = {
              mode: 'ExactOut',
              assetIn: PoolAssets.QUA_TON,
              assetOut: PoolAssets.TS_TON,
              amountOut: expectedAmountOut,
            };

            // Send swap
            const sendExactOutArgs = await getPayload(torchSDK, swapExactOutParams, sender);
            await send(sendExactOutArgs);

            await Promise.all([
              // Sender quaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, amountIn),
              // Sender tsTON balance should be increased
              checkJettonBalIncrease(senderTsTONWallet, senderTsTONBalBefore),
            ]);

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
              assetIn: PoolAssets.QUA_TON,
              assetOut: PoolAssets.TS_TON,
              amountIn,
              recipient: recipient.address,
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);
            await send(sendArgs);

            await Promise.all([
              // Sender quaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, amountIn),
              // Sender tsTON balance should be not changed
              checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore),
              // Recipient tsTON balance should be increased
              checkJettonBalIncrease(recipientTsTONWallet, 0n),
            ]);
          });

          it('should refund quaTON to sender when min amount out is not met (quaTON -> stTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = 10n ** 16n;
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.QUA_TON,
              assetOut: PoolAssets.ST_TON,
              amountIn,
              minAmountOut: toNano('1'),
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);
            await send(sendArgs);

            // Sender quaTON balance should not be changed
            await checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore);

            // Sender stTON balance should not be changed
            await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
          });

          it('should refund TriTON to sender when min amount out is not met (quaTON -> stTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = toUnit(0.01, Decimals.QUA_TON);
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.QUA_TON,
              assetOut: PoolAssets.ST_TON,
              amountIn,
            };

            // Simulate to get amount out
            const simulateResult = await torchSDK.simulateSwap(swapParams);
            if (simulateResult.result.mode != 'ExactIn') {
              throw new Error('Simulate result is not ExactIn');
            }
            swapParams.minAmountOut = simulateResult.result.amountOut - 100n; // Make it can pass the first pool minAmountOut check, but not pass the second pool minAmountOut check

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);

            // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the second pool
            await swapImpactTriTON();

            // Reset balance
            senderStTONBalBefore = await senderStTONWallet.getBalance();
            senderTsTONBalBefore = await senderTsTONWallet.getBalance();

            // Send swap
            await send(sendArgs);

            await Promise.all([
              // Sender quaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, amountIn),
              // Sender stTON balance should not be changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
            ]);
          });

          it('should refund quaTON to sender when slippage is not met (quaTON -> stTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = 10n ** 16n;
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.QUA_TON,
              assetOut: PoolAssets.ST_TON,
              amountIn,
              slippageTolerance: 0.01,
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);

            // Someone swap to make the price fluctuate in QuaTON pool, so that it will be refunded in the second pool
            await swapImpactQuaTON(PoolAssets.H_TON, PoolAssets.TRI_TON, toUnit(50, Decimals.HTON));

            // Reset balance
            senderTriTONBalBefore = await senderTriTONWallet.getBalance();
            senderHTONBalBefore = await senderHTONWallet.getBalance();

            // Send swap
            await send(sendArgs);

            await Promise.all([
              // Sender quaTON balance should not be changed
              checkJettonBalNotChanged(senderQuaTONWallet, senderQuaTONBalBefore),
              // Sender stTON balance should not be changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
            ]);
          });

          it('should refund stTON to sender when slippage is not met (quaTON -> stTON ExactIn)', async () => {
            // Build swap payload
            const amountIn = 10n ** 16n;
            const swapParams: SwapParams = {
              mode: 'ExactIn',
              assetIn: PoolAssets.QUA_TON,
              assetOut: PoolAssets.ST_TON,
              amountIn,
              slippageTolerance: 0.01,
            };

            // Send swap
            const sendArgs = await getPayload(torchSDK, swapParams, sender);

            // Someone swap to make the price fluctuate in TriTON pool, so that it will be refunded in the second pool
            await swapImpactTriTON(PoolAssets.TS_TON, PoolAssets.ST_TON, toNano('50'));

            // Reset balance
            senderStTONBalBefore = await senderStTONWallet.getBalance();
            senderTsTONBalBefore = await senderTsTONWallet.getBalance();

            // Send swap
            await send(sendArgs);

            await Promise.all([
              // Sender quaTON balance should be decreased
              checkJettonBalDecrease(senderQuaTONWallet, senderQuaTONBalBefore, amountIn),
              // Sender stTON balance should not be changed
              checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore),
              // Sender TriTON balance should be increased
              checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore),
            ]);
          });
        });
      });

      describe('Swap in TriUSD Pool', () => {
        it('should swap USDT to USDC with ExactIn and ExactOut', async () => {
          // Build ExactIn payload
          const amountIn = toNano('0.05');
          const swapExactInParams: SwapParams = {
            mode: 'ExactIn',
            assetIn: PoolAssets.USDT,
            assetOut: PoolAssets.USDC,
            amountIn,
          };

          // Simulate swap ExactIN
          const swapExactInResult = await torchSDK.simulateSwap(swapExactInParams);

          const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
          await send(sendExactInArgs);

          await Promise.all([
            // Sender USDT balance should be decreased
            checkJettonBalDecrease(senderUSDTWallet, senderUSDTBalBefore, amountIn),
            // Sender USDC balance should be increased
            checkJettonBalIncrease(senderUSDCWallet, senderUSDCBalBefore),
          ]);

          // Restore blockchain state
          await blockchain.loadFrom(initBlockchainState);

          if (swapExactInResult.result.mode != 'ExactIn') {
            throw new Error('Swap mode is not ExactIn');
          }

          // Build ExactOut payload
          const swapExactOutParams: SwapParams = {
            mode: 'ExactOut',
            assetIn: PoolAssets.USDT,
            assetOut: PoolAssets.USDC,
            amountOut: swapExactInResult.result.amountOut,
          };

          // Send swap
          const sendExactOutArgs = await getPayload(torchSDK, swapExactOutParams, sender);
          await send(sendExactOutArgs);

          await Promise.all([
            // Sender USDT balance should be decreased
            checkJettonBalDecrease(senderUSDTWallet, senderUSDTBalBefore, amountIn),
            // Sender USDC balance should be increased
            checkJettonBalIncrease(senderUSDCWallet, senderUSDCBalBefore),
          ]);

          // Sender USDT amount decrease amount
          const senderUSDTBalAfter = await senderUSDTWallet.getBalance();
          const senderUSDTBalDecrease = senderUSDTBalBefore - senderUSDTBalAfter;
          const difference = abs(senderUSDTBalDecrease, amountIn);
          expect(difference < toNano(0.01)).toBeTruthy();
        });
      });

      describe('Cross pool swap in TriUSD Pool and QuaUSD Pool', () => {
        it('should swap USDC to QuaUSD (Deposit and Deposit)', async () => {
          const amountIn = toNano('0.05');
          const swapExactInParams: SwapParams = {
            mode: 'ExactIn',
            assetIn: PoolAssets.USDC,
            assetOut: PoolAssets.QUA_USD,
            amountIn,
          };

          // Send swap
          const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
          await send(sendExactInArgs);

          await Promise.all([
            // Sender USDC balance should be decreased
            checkJettonBalDecrease(senderUSDCWallet, senderUSDCBalBefore, amountIn),
            // Sender QuaUSD balance should be increased
            checkJettonBalIncrease(senderQuaUSDWallet, senderQuaUSDBalBefore),
          ]);
        });

        it('should swap USDT to SCRV_USD (Deposit and Swap)', async () => {
          const amountIn = toNano('0.05');
          const swapExactInParams: SwapParams = {
            mode: 'ExactIn',
            assetIn: PoolAssets.USDT,
            assetOut: PoolAssets.SCRV_USD,
            amountIn,
          };

          // Send swap
          const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
          await send(sendExactInArgs);

          await Promise.all([
            // Sender USDT balance should be decreased
            checkJettonBalDecrease(senderUSDTWallet, senderUSDTBalBefore, amountIn),
            // Sender SCRV_USD balance should be increased
            checkJettonBalIncrease(senderScrvUSDWallet, senderSCRVUSDBalBefore),
          ]);
        });

        it('should swap SCRV_USD to USDT (Swap and Withdraw)', async () => {
          const amountIn = toUnit(1, Decimals.SCRV_USD);
          const swapExactInParams: SwapParams = {
            mode: 'ExactIn',
            assetIn: PoolAssets.SCRV_USD,
            assetOut: PoolAssets.USDT,
            amountIn,
          };

          // Send swap
          const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
          await send(sendExactInArgs);

          await Promise.all([
            // Sender SCRV_USD balance should be decreased
            checkJettonBalDecrease(senderScrvUSDWallet, senderSCRVUSDBalBefore, amountIn),
            // Sender USDT balance should be increased
            checkJettonBalIncrease(senderUSDTWallet, senderUSDTBalBefore),
          ]);
        });

        it('should swap QUA_USD to USDT (Withdraw and Withdraw)', async () => {
          const amountIn = toUnit(1, Decimals.QUA_USD);
          const swapExactInParams: SwapParams = {
            mode: 'ExactIn',
            assetIn: PoolAssets.QUA_USD,
            assetOut: PoolAssets.USDT,
            amountIn,
          };

          // Send swap
          const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
          await send(sendExactInArgs);

          await Promise.all([
            // Sender QuaUSD balance should be decreased
            checkJettonBalDecrease(senderQuaUSDWallet, senderQuaUSDBalBefore, amountIn),
            // Sender USDT balance should be increased
            checkJettonBalIncrease(senderUSDTWallet, senderUSDTBalBefore),
          ]);
        });
      });

      // describe('Cross pool swap in tgUSD/USDT pool and stgUSD/tgUSD Pool', () => {
      //   it('should swap USDT to stgUSD (ExactIn)', async () => {
      //     const amountIn = 100000n;
      //     const swapExactInParams: SwapParams = {
      //       mode: 'ExactIn',
      //       assetIn: PoolAssets.USDT,
      //       assetOut: PoolAssets.STGUSD,
      //       amountIn,
      //       slippageTolerance: 0.01,
      //     };

      //     // Send swap
      //     const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
      //     await send(sendExactInArgs);

      //     await Promise.all([
      //       // Sender USDT balance should be decreased
      //       checkJettonBalDecrease(senderUSDTWallet, senderUSDTBalBefore, amountIn),
      //       // Sender stgUSD balance should be increased
      //       checkJettonBalIncrease(senderStgUSDWallet, senderStgUSDBalBefore),
      //     ]);
      //   });

      //   it('should swap USDT to stgUSD (ExactOut)', async () => {
      //     const amountOut = 100000n;
      //     const swapExactOutParams: SwapParams = {
      //       mode: 'ExactOut',
      //       assetIn: PoolAssets.USDT,
      //       assetOut: PoolAssets.STGUSD,
      //       amountOut,
      //       slippageTolerance: 0.01,
      //     };

      //     // Send swap
      //     const sendExactOutArgs = await getPayload(torchSDK, swapExactOutParams, sender);
      //     await send(sendExactOutArgs);

      //     await Promise.all([
      //       // Sender USDT balance should be decreased
      //       checkJettonBalDecrease(senderUSDTWallet, senderUSDTBalBefore),
      //       // Sender stgUSD balance should be increased
      //       checkJettonBalIncrease(senderStgUSDWallet, senderStgUSDBalBefore),
      //     ]);
      //   });

      //   it('should swap stgUSD to USDT (ExactIn)', async () => {
      //     const amountIn = 100000n;
      //     const swapExactInParams: SwapParams = {
      //       mode: 'ExactIn',
      //       assetIn: PoolAssets.STGUSD,
      //       assetOut: PoolAssets.USDT,
      //       amountIn,
      //       slippageTolerance: 0.01,
      //     };

      //     // Send swap
      //     const sendExactInArgs = await getPayload(torchSDK, swapExactInParams, sender);
      //     await send(sendExactInArgs);

      //     await Promise.all([
      //       // Sender stgUSD balance should be decreased
      //       checkJettonBalDecrease(senderStgUSDWallet, senderStgUSDBalBefore, amountIn),
      //       // Sender USDT balance should be increased
      //       checkJettonBalIncrease(senderUSDTWallet, senderUSDTBalBefore),
      //     ]);
      //   });

      //   it('should swap stgUSD to USDT (ExactOut)', async () => {
      //     const amountOut = 100000n;
      //     const swapExactOutParams: SwapParams = {
      //       mode: 'ExactOut',
      //       assetIn: PoolAssets.STGUSD,
      //       assetOut: PoolAssets.USDT,
      //       amountOut,
      //       slippageTolerance: 0.01,
      //     };

      //     // Send swap
      //     const sendExactOutArgs = await getPayload(torchSDK, swapExactOutParams, sender);
      //     await send(sendExactOutArgs);

      //     await Promise.all([
      //       // Sender stgUSD balance should be decreased
      //       checkJettonBalDecrease(senderStgUSDWallet, senderStgUSDBalBefore),
      //       // Sender USDT balance should be increased
      //       checkJettonBalIncrease(senderUSDTWallet, senderUSDTBalBefore),
      //     ]);
      //   });
      // });
    });
  }

  Promise.all([
    createSwapTests('Swap Tests (Simulation)', async (sdk, params, sender) => {
      const simulateResponse = await sdk.simulateSwap(params);
      return await simulateResponse.getSwapPayload(sender, { blockNumber });
    }),

    createSwapTests('Swap Tests (Direct)', async (sdk, params, sender) => {
      return await sdk.getSwapPayload(sender, params, { blockNumber });
    }),
  ]);
});
