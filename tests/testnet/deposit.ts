import { Blockchain, BlockchainSnapshot, internal, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { DepositParams, TorchSDK, toUnit } from '../../src';
import { Decimals, PoolAssets } from './helper/config';
import { Address, SenderArguments, toNano } from '@ton/core';
import { JettonWallet } from '@ton/ton';
import {
  checkJettonBalDecrease,
  checkJettonBalIncrease,
  checkJettonBalNotChanged,
  checkTONBalDecrease,
} from './helper/check';
import { initialize } from './helper/setup';
import { LpAccount, Pool } from '@torch-finance/dex-contract-wrapper';
import { Allocation } from '@torch-finance/core';

describe('Deposit Testcases', () => {
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

  // Sender Jetton Wallet
  let senderStTONWallet: SandboxContract<JettonWallet>;
  let senderTsTONWallet: SandboxContract<JettonWallet>;
  let senderHTONWallet: SandboxContract<JettonWallet>;
  let senderTriTONWallet: SandboxContract<JettonWallet>;
  let senderQuaTONWallet: SandboxContract<JettonWallet>;
  // let senderUSDTWallet: SandboxContract<JettonWallet>;
  let senderUSDCWallet: SandboxContract<JettonWallet>;
  // let senderCrvUSDWallet: SandboxContract<JettonWallet>;
  let senderScrvUSDWallet: SandboxContract<JettonWallet>;
  let senderTriUSDWallet: SandboxContract<JettonWallet>;
  let senderQuaUSDWallet: SandboxContract<JettonWallet>;

  // Recipient Jetton Wallet
  let recipientTriTONWallet: SandboxContract<JettonWallet>;
  let recipientQuaTONWallet: SandboxContract<JettonWallet>;

  // Sender Asset Balance Before
  let senderTonBalBefore: bigint;
  let senderStTONBalBefore: bigint;
  let senderTsTONBalBefore: bigint;
  let senderHTONBalBefore: bigint;
  let senderTriTONBalBefore: bigint;
  let senderQuaTONBalBefore: bigint;
  // let senderUSDTBalBefore: bigint;
  let senderUSDCBalBefore: bigint;
  // let senderCRVUSDBalBefore: bigint;
  let senderSCRVUSDBalBefore: bigint;
  let senderTriUSDBalBefore: bigint;
  let senderQuaUSDBalBefore: bigint;

  let blockNumber: number;

  // Send function
  let send: (args: SenderArguments[] | SenderArguments) => Promise<void>;

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
      // senderUSDTWallet,
      senderUSDCWallet,
      // senderCrvUSDWallet,
      senderScrvUSDWallet,
      senderTriTONWallet,
      senderQuaTONWallet,
      senderTriUSDWallet,
      senderQuaUSDWallet,
      send,
      blockNumber,
    } = await initialize());
    recipient = await blockchain.treasury('recipient');
    recipientTriTONWallet = blockchain.openContract(
      JettonWallet.create(await triTONPool.getWalletAddress(recipient.address)),
    );
    recipientQuaTONWallet = blockchain.openContract(
      JettonWallet.create(await quaTONPool.getWalletAddress(recipient.address)),
    );
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
      // senderUSDTBalBefore,
      senderUSDCBalBefore,
      // senderCRVUSDBalBefore,
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
      // senderUSDTWallet.getBalance(),
      senderUSDCWallet.getBalance(),
      // senderCrvUSDWallet.getBalance(),
      senderScrvUSDWallet.getBalance(),
      senderTriUSDWallet.getBalance(),
      senderQuaUSDWallet.getBalance(),
    ]);
  });

  function createDepositTests(
    description: string,
    getPayload: (sender: Address, params: DepositParams) => Promise<SenderArguments[] | SenderArguments>,
  ) {
    const depositImpactTriTON = async (
      depositAmounts: Allocation[] = Allocation.createAllocations([
        { asset: PoolAssets.TON, value: toNano('100') },
        { asset: PoolAssets.TS_TON, value: toNano('11') },
        { asset: PoolAssets.ST_TON, value: toNano('1.1') },
      ]),
    ) => {
      const depositFluctuateParams: DepositParams = {
        pool: triTONPool.address,
        depositAmounts,
      };

      // Send deposit
      const sendDepositFluctuateArgs = await getPayload(sender, depositFluctuateParams);
      await send(sendDepositFluctuateArgs);

      // Reset balance
      senderTriTONBalBefore = await senderTriTONWallet.getBalance();
      senderTonBalBefore = (await blockchain.getContract(sender)).balance;
      senderStTONBalBefore = await senderStTONWallet.getBalance();
      senderTsTONBalBefore = await senderTsTONWallet.getBalance();
    };

    describe('Deposit in TriTON Pool', () => {
      afterEach(async () => {
        // Sender triTON balance should be increased
        await checkJettonBalIncrease(senderTriTONWallet, senderTriTONBalBefore);
      });

      it('should deposit TON, tsTON and stTON to triTON pool', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: Allocation.createAllocations([
            { asset: PoolAssets.TON, value: toNano('1') },
            { asset: PoolAssets.TS_TON, value: toNano('1') },
            { asset: PoolAssets.ST_TON, value: toNano('1') },
          ]),
        };

        // Send deposit
        const sendDepositArgs = await getPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender TON, tsTON and stTON balance should be decreased
        await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
        await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore);
        await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
      });

      it('should refund TON, tsTON and stTON when slippage is not met', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: Allocation.createAllocations([
            { asset: PoolAssets.TON, value: toNano('100') },
            { asset: PoolAssets.TS_TON, value: toNano('11') },
            { asset: PoolAssets.ST_TON, value: toNano('1.1') },
          ]),
          slippageTolerance: 0.01,
        };

        // Send deposit
        const sendDepositArgs = await getPayload(sender, depositParams);

        // Someone deposit to make the price fluctuate
        await depositImpactTriTON();

        await send(sendDepositArgs);

        // Sender triTON balance should not be changed
        await checkJettonBalNotChanged(senderTriTONWallet, senderTriTONBalBefore);

        // Sender tsTON and stTON balance should be not changed
        await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
        await checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore);

        // Sender TON balance should be only decreased by gas fee
        await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);

        senderTriTONBalBefore = 0n; // This is for pass the afterEach check
      });

      it('should deposit TON and stTON to triTON pool', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: Allocation.createAllocations([
            { asset: PoolAssets.TON, value: toNano('1') },
            { asset: PoolAssets.ST_TON, value: toNano('1') },
          ]),
        };

        // Send deposit
        const sendDepositArgs = await getPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender TON and stTON balance should be decreased
        await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
        await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
      });

      it('should refund TON and stTON when slippage is not met', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: Allocation.createAllocations([
            { asset: PoolAssets.TON, value: toNano('100') },
            { asset: PoolAssets.ST_TON, value: toNano('1.1') },
          ]),
          slippageTolerance: 0.01,
        };

        // Send deposit
        const sendDepositArgs = await getPayload(sender, depositParams);

        // Someone deposit to make the price fluctuate
        await depositImpactTriTON();

        await send(sendDepositArgs);

        // Sender stTON balance should be not changed
        await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);

        // Sender TON balance should be only decreased by gas fee
        await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);

        senderTriTONBalBefore = 0n; // This is for pass the afterEach check
      });

      it('should deposit tsTON and stTON to triTON pool', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: Allocation.createAllocations([
            { asset: PoolAssets.TS_TON, value: toNano('1') },
            { asset: PoolAssets.ST_TON, value: toNano('1') },
          ]),
        };

        // Send deposit
        const sendDepositArgs = await getPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender tsTON and stTON balance should be decreased
        await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
        await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore);
      });

      it('should refund tsTON and stTON when slippage is not met', async () => {
        // Build deposit params
        const depositAmounts = Allocation.createAllocations([
          { asset: PoolAssets.TS_TON, value: toNano('100') },
          { asset: PoolAssets.ST_TON, value: toNano('1.1') },
        ]);
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts,
          slippageTolerance: 0.01,
        };

        // Send deposit
        const sendDepositArgs = await getPayload(sender, depositParams);

        // Someone deposit to make the price fluctuate
        await depositImpactTriTON(depositAmounts);

        await send(sendDepositArgs);

        // Sender tsTON and stTON balance should be not changed
        await checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore);
        await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);

        senderTriTONBalBefore = 0n; // This is for pass the afterEach check
      });

      it('should deposit TON triTON pool', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: new Allocation({ asset: PoolAssets.TON, value: toNano('1') }),
        };

        // Send deposit
        const sendDepositArgs = await getPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender TON balance should be decreased
        await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
      });

      it('should refund TON when slippage is not met', async () => {
        // Build deposit params
        const depositAmounts = Allocation.createAllocations([{ asset: PoolAssets.TON, value: toNano('100') }]);
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts,
          slippageTolerance: 0.01,
        };

        // Send deposit
        const sendDepositArgs = await getPayload(sender, depositParams);

        // Someone deposit to make the price fluctuate
        await depositImpactTriTON(depositAmounts);

        await send(sendDepositArgs);

        // Sender TON balance should be only decreased by gas fee
        await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);

        // Sender triTON balance should be not changed
        await checkJettonBalNotChanged(senderTriTONWallet, senderTriTONBalBefore);

        senderTriTONBalBefore = 0n; // This is for pass the afterEach check
      });

      it('should deposit stTON to triTON pool', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: new Allocation({ asset: PoolAssets.ST_TON, value: toNano('1') }),
        };

        // Send deposit
        const sendDepositArgs = await getPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender stTON balance should be decreased
        await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
      });

      it('should refund stTON when slippage is not met', async () => {
        // Build deposit params
        const depositAmounts = Allocation.createAllocations([{ asset: PoolAssets.ST_TON, value: toNano('100') }]);
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts,
          slippageTolerance: 0.01,
        };

        // Send deposit
        const sendDepositArgs = await getPayload(sender, depositParams);

        // Someone deposit to make the price fluctuate
        await depositImpactTriTON(depositAmounts);

        await send(sendDepositArgs);

        // Sender stTON balance should be not changed
        await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);

        senderTriTONBalBefore = 0n; // This is for pass the afterEach check
      });

      it('should deposit stTON to triTON pool with recipient', async () => {
        // Build deposit params
        const depositParams: DepositParams = {
          pool: triTONPool.address,
          depositAmounts: new Allocation({ asset: PoolAssets.ST_TON, value: toNano('1') }),
          recipient: recipient.address,
        };

        // Send deposit
        const sendDepositArgs = await getPayload(sender, depositParams);
        await send(sendDepositArgs);

        // Sender stTON balance should be decreased
        await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);

        // Recipient triTON balance should be increased
        const recipientTriTONBalance = await recipientTriTONWallet.getBalance();
        expect(recipientTriTONBalance).toBeGreaterThan(0);

        senderTriTONBalBefore = 0n; // This is for pass the afterEach check
      });
    });

    describe('Deposit and Deposit in TriTON Pool and QuaTON Pool', () => {
      afterEach(async () => {
        // Sender quaTON Lp balance should be increased
        await checkJettonBalIncrease(senderQuaTONWallet, senderQuaTONBalBefore);
      });

      describe('With Meta Asset', () => {
        it('should deposit TON, tsTON, stTON and hTON to quaTON pool', async () => {
          // Build deposit params
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts: Allocation.createAllocations([
              { asset: PoolAssets.TON, value: toNano('1') },
              { asset: PoolAssets.TS_TON, value: toNano('1') },
              { asset: PoolAssets.ST_TON, value: toNano('1') },
            ]),
            nextDeposit: {
              pool: quaTONPool.address,
              depositAmounts: new Allocation({ asset: PoolAssets.H_TON, value: toNano('1') }),
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);
          await send(sendDepositArgs);

          // Sender TON, tsTON, stTON and hTON balance should be decreased
          await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
          await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore);
          await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
          await checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore);
        });

        it('should refund TON, tsTON, stTON and hTON when slippage is not met', async () => {
          // Build deposit params
          const depositAmounts = Allocation.createAllocations([
            { asset: PoolAssets.TON, value: toNano('100') },
            { asset: PoolAssets.TS_TON, value: toNano('11') },
            { asset: PoolAssets.ST_TON, value: toNano('1.1') },
          ]);
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts,
            nextDeposit: {
              pool: quaTONPool.address,
              depositAmounts: new Allocation({ asset: PoolAssets.H_TON, value: toNano('1') }),
            },
            slippageTolerance: 0.01,
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);

          // Someone deposit to make the price fluctuate
          await depositImpactTriTON(depositAmounts);

          await send(sendDepositArgs);

          // Sender TON, tsTON, stTON and hTON balance should be not changed
          await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
          await checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore);
          await checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore);
          await checkJettonBalNotChanged(senderTriTONWallet, senderTriTONBalBefore);

          // Sender TON balance should be only decreased by gas fee
          await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);

          senderQuaTONBalBefore = 0n; // This is for pass the afterEach check
        });

        it('should deposit TON, stTON and hTON to quaTON pool', async () => {
          // Build deposit params
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts: Allocation.createAllocations([
              { asset: PoolAssets.TON, value: toNano('1') },
              { asset: PoolAssets.ST_TON, value: toNano('1') },
            ]),
            nextDeposit: {
              pool: quaTONPool.address,
              depositAmounts: new Allocation({ asset: PoolAssets.H_TON, value: toNano('1') }),
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);
          await send(sendDepositArgs);

          // Sender TON, stTON and hTON balance should be decreased
          await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
          await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
          await checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore);
        });

        it('should refund TON, stTON and hTON when slippage is not met', async () => {
          // Build deposit params
          const depositAmounts = Allocation.createAllocations([
            { asset: PoolAssets.TON, value: toNano('100') },
            { asset: PoolAssets.ST_TON, value: toNano('1.1') },
          ]);
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts,
            nextDeposit: {
              pool: quaTONPool.address,
              depositAmounts: new Allocation({ asset: PoolAssets.H_TON, value: toNano('1') }),
            },
            slippageTolerance: 0.01,
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);

          // Someone deposit to make the price fluctuate
          await depositImpactTriTON(depositAmounts);

          await send(sendDepositArgs);

          // Sender TON, stTON and hTON balance should be not changed
          await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
          await checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore);
          await checkJettonBalNotChanged(senderTriTONWallet, senderTriTONBalBefore);

          // Sender TON balance should be only decreased by gas fee
          await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);

          senderQuaTONBalBefore = 0n; // This is for pass the afterEach check
        });

        it('should deposit TON and hTON to quaTON pool', async () => {
          // Build deposit params
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts: new Allocation({ asset: PoolAssets.TON, value: toNano('1') }),
            nextDeposit: {
              pool: quaTONPool.address,
              depositAmounts: new Allocation({ asset: PoolAssets.H_TON, value: toNano('1') }),
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);
          await send(sendDepositArgs);

          // Sender TON and hTON balance should be decreased
          await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
          await checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore);
        });

        it('should refund TON and hTON when slippage is not met', async () => {
          // Build deposit params
          const depositAmounts = Allocation.createAllocations([{ asset: PoolAssets.TON, value: toNano('100') }]);
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts,
            nextDeposit: {
              pool: quaTONPool.address,
              depositAmounts: new Allocation({ asset: PoolAssets.H_TON, value: toNano('50') }),
            },
            slippageTolerance: 0.01,
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);

          // Someone deposit to make the price fluctuate
          await depositImpactTriTON(depositAmounts);

          await send(sendDepositArgs);

          // Sender TON and hTON balance should be not changed
          await checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore);
          await checkJettonBalNotChanged(senderTriTONWallet, senderTriTONBalBefore);

          // Sender TON balance should be only decreased by gas fee
          await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);

          senderQuaTONBalBefore = 0n; // This is for pass the afterEach check
        });

        it('should deposit stTON and hTON to quaTON pool', async () => {
          // Build deposit params
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts: new Allocation({ asset: PoolAssets.ST_TON, value: toNano('1') }),
            nextDeposit: {
              pool: quaTONPool.address,
              depositAmounts: new Allocation({ asset: PoolAssets.H_TON, value: toNano('1') }),
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);
          await send(sendDepositArgs);

          // Sender stTON and hTON balance should be decreased
          await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
          await checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore);
        });

        it('should refund stTON and hTON when slippage is not met', async () => {
          // Build deposit params
          const depositAmounts = Allocation.createAllocations([{ asset: PoolAssets.ST_TON, value: toNano('100') }]);
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts,
            nextDeposit: {
              pool: quaTONPool.address,
              depositAmounts: new Allocation({ asset: PoolAssets.H_TON, value: toNano('50') }),
            },
            slippageTolerance: 0.01,
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);

          // Someone deposit to make the price fluctuate
          await depositImpactTriTON(depositAmounts);

          await send(sendDepositArgs);

          // Sender stTON and hTON balance should be not changed
          await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
          await checkJettonBalNotChanged(senderHTONWallet, senderHTONBalBefore);
          await checkJettonBalNotChanged(senderTriTONWallet, senderTriTONBalBefore);

          senderQuaTONBalBefore = 0n; // This is for pass the afterEach check
        });

        it('should deposit stTON and hTON to quaTON pool with recipient', async () => {
          const recipient = await blockchain.treasury('recipient');
          // Build deposit params
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts: new Allocation({ asset: PoolAssets.ST_TON, value: toNano('1') }),
            nextDeposit: {
              pool: quaTONPool.address,
              depositAmounts: new Allocation({ asset: PoolAssets.H_TON, value: toNano('1') }),
            },
            recipient: recipient.address,
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);
          await send(sendDepositArgs);

          // Sender stTON and hTON balance should be decreased
          await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
          await checkJettonBalDecrease(senderHTONWallet, senderHTONBalBefore);

          // Recipient quaTON balance should be increased
          const recipientQuaTONBalance = await recipientQuaTONWallet.getBalance();
          expect(recipientQuaTONBalance).toBeGreaterThan(0);

          senderQuaTONBalBefore = 0n; // This is for pass the afterEach check
        });
      });

      describe('Without Meta Asset', () => {
        it('should deposit TON, tsTON and stTON to quaTON pool', async () => {
          // Build deposit params
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts: Allocation.createAllocations([
              { asset: PoolAssets.TON, value: toNano('1') },
              { asset: PoolAssets.TS_TON, value: toNano('1') },
              { asset: PoolAssets.ST_TON, value: toNano('1') },
            ]),
            nextDeposit: {
              pool: quaTONPool.address,
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);
          await send(sendDepositArgs);

          // Sender TON, tsTON and stTON balance should be decreased
          await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
          await checkJettonBalDecrease(senderTsTONWallet, senderTsTONBalBefore);
          await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
        });

        it('should refund TON, tsTON and stTON when slippage is not met', async () => {
          // Build deposit params
          const depositAmounts = Allocation.createAllocations([
            { asset: PoolAssets.TON, value: toNano('100') },
            { asset: PoolAssets.TS_TON, value: toNano('11') },
            { asset: PoolAssets.ST_TON, value: toNano('1.1') },
          ]);
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts,
            slippageTolerance: 0.01,
            nextDeposit: {
              pool: quaTONPool.address,
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);

          // Someone deposit to make the price fluctuate
          await depositImpactTriTON(depositAmounts);
          await send(sendDepositArgs);

          // Sender tsTON and stTON balance should not changed
          await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);
          await checkJettonBalNotChanged(senderTsTONWallet, senderTsTONBalBefore);

          // Sender TON balance should be only decreased by gas fee
          await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);

          senderQuaTONBalBefore = 0n; // This is for pass the afterEach check
        });

        it('should deposit TON and stTON to quaTON pool', async () => {
          // Build deposit params
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts: Allocation.createAllocations([
              { asset: PoolAssets.TON, value: toNano('1') },
              { asset: PoolAssets.ST_TON, value: toNano('1') },
            ]),
            nextDeposit: {
              pool: quaTONPool.address,
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);
          await send(sendDepositArgs);

          // Sender TON and stTON balance should be decreased
          await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
          await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
        });

        it('should refund TON and stTON when slippage is not met', async () => {
          // Build deposit params
          const depositAmounts = Allocation.createAllocations([
            { asset: PoolAssets.TON, value: toNano('100') },
            { asset: PoolAssets.ST_TON, value: toNano('1.1') },
          ]);
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts,
            slippageTolerance: 0.01,
            nextDeposit: {
              pool: quaTONPool.address,
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);

          // Someone deposit to make the price fluctuate
          await depositImpactTriTON(depositAmounts);
          await send(sendDepositArgs);

          // Sender stTON balance should not changed
          await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);

          // Sender TON balance should be only decreased by gas fee
          await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);

          senderQuaTONBalBefore = 0n; // This is for pass the afterEach check
        });

        it('should deposit TON to quaTON pool', async () => {
          // Build deposit params
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts: new Allocation({ asset: PoolAssets.TON, value: toNano('1') }),
            nextDeposit: {
              pool: quaTONPool.address,
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);
          await send(sendDepositArgs);

          // Sender TON balance should be decreased
          await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);
        });

        it('should refund TON when slippage is not met', async () => {
          // Build deposit params
          const depositAmounts = Allocation.createAllocations([{ asset: PoolAssets.TON, value: toNano('100') }]);
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts,
            slippageTolerance: 0.01,
            nextDeposit: {
              pool: quaTONPool.address,
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);

          // Someone deposit to make the price fluctuate
          await depositImpactTriTON(depositAmounts);
          await send(sendDepositArgs);

          // Sender TON balance should be only decreased by gas fee
          await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);

          senderQuaTONBalBefore = 0n; // This is for pass the afterEach check
        });

        it('should deposit stTON to quaTON pool', async () => {
          // Build deposit params
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts: new Allocation({ asset: PoolAssets.ST_TON, value: toNano('1') }),
            nextDeposit: {
              pool: quaTONPool.address,
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);
          await send(sendDepositArgs);

          // Sender stTON balance should be decreased
          await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);
        });

        it('should deposit stTON to quaTON pool with recipient', async () => {
          const recipient = await blockchain.treasury('recipient');
          // Build deposit params
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts: new Allocation({ asset: PoolAssets.ST_TON, value: toNano('1') }),
            nextDeposit: {
              pool: quaTONPool.address,
            },
            recipient: recipient.address,
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);
          await send(sendDepositArgs);

          // Sender stTON balance should be decreased
          await checkJettonBalDecrease(senderStTONWallet, senderStTONBalBefore);

          // Recipient quaTON balance should be increased
          const recipientQuaTONBalance = await recipientQuaTONWallet.getBalance();
          expect(recipientQuaTONBalance).toBeGreaterThan(0);

          senderQuaTONBalBefore = 0n; // This is for pass the afterEach check
        });

        it('should refund stTON when slippage is not met', async () => {
          // Build deposit params
          const depositAmounts = Allocation.createAllocations([{ asset: PoolAssets.ST_TON, value: toNano('100') }]);
          const depositParams: DepositParams = {
            pool: triTONPool.address,
            depositAmounts,
            slippageTolerance: 0.01,
            nextDeposit: {
              pool: quaTONPool.address,
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);

          // Someone deposit to make the price fluctuate
          await depositImpactTriTON(depositAmounts);
          await send(sendDepositArgs);

          // Sender stTON balance should not changed
          await checkJettonBalNotChanged(senderStTONWallet, senderStTONBalBefore);

          // Sender TON balance should be only decreased by gas fee
          await checkTONBalDecrease(blockchain, sender, senderTonBalBefore);

          senderQuaTONBalBefore = 0n; // This is for pass the afterEach check
        });
      });
    });

    // describe('Deposit in TriUSD Pool', () => {
    //   it('should deposit USDT, USDC and CRV_USD to triUSDPool', async () => {
    //     // Build deposit params
    //     const depositParams: DepositParams = {
    //       pool: triUSDPool.address,
    //       depositAmounts: Allocation.createAllocations([
    //         { asset: PoolAssets.USDT, value: toUnit(1, Decimals.USDT) },
    //         { asset: PoolAssets.USDC, value: toUnit(1, Decimals.USDC) },
    //         { asset: PoolAssets.CRV_USD, value: toUnit(1, Decimals.CRV_USD) },
    //       ]),
    //     };

    //     // Send deposit
    //     const sendDepositArgs = await getPayload(sender, depositParams);
    //     await send(sendDepositArgs);

    //     await Promise.all([
    //       // Sender USDT, USDC and CRV_USD balance should be decreased
    //       checkJettonBalDecrease(senderUSDTWallet, senderUSDTBalBefore),
    //       checkJettonBalDecrease(senderUSDCWallet, senderUSDCBalBefore),
    //       checkJettonBalDecrease(senderCrvUSDWallet, senderCRVUSDBalBefore),
    //       // Sender triUSDPool balance should be increased
    //       checkJettonBalIncrease(senderTriUSDWallet, senderTriUSDBalBefore),
    //     ]);
    //   });

    //   it('should deposit USDT to triUSDPool', async () => {
    //     // Build deposit params
    //     const depositParams: DepositParams = {
    //       pool: triUSDPool.address,
    //       depositAmounts: new Allocation({ asset: PoolAssets.USDT, value: toUnit(1, Decimals.USDT) }),
    //     };

    //     // Send deposit
    //     const sendDepositArgs = await getPayload(sender, depositParams);
    //     await send(sendDepositArgs);

    //     await Promise.all([
    //       // Sender USDT balance should be decreased
    //       checkJettonBalDecrease(senderUSDTWallet, senderUSDTBalBefore),
    //       // Sender triUSDPool balance should be increased
    //       checkJettonBalIncrease(senderTriUSDWallet, senderTriUSDBalBefore),
    //     ]);
    //   });
    // });

    describe('Deposit and Deposit in TriUSDPool and QuaUSDPool', () => {
      describe('Without meta asset', () => {
        // it('should deposit USDT, USDC and CRV_USD to triUSDPool and QuaUSDPool', async () => {
        //   // Build deposit params
        //   const depositParams: DepositParams = {
        //     pool: triUSDPool.address,
        //     depositAmounts: Allocation.createAllocations([
        //       { asset: PoolAssets.USDT, value: toUnit(1, Decimals.USDT) },
        //       { asset: PoolAssets.USDC, value: toUnit(1, Decimals.USDC) },
        //       { asset: PoolAssets.CRV_USD, value: toUnit(1, Decimals.CRV_USD) },
        //     ]),
        //     nextDeposit: {
        //       pool: quaUSDPool.address,
        //     },
        //   };

        //   // Send deposit
        //   const sendDepositArgs = await getPayload(sender, depositParams);
        //   await send(sendDepositArgs);

        //   await Promise.all([
        //     // Sender USDT, USDC and CRV_USD balance should be decreased
        //     checkJettonBalDecrease(senderUSDTWallet, senderUSDTBalBefore),
        //     checkJettonBalDecrease(senderUSDCWallet, senderUSDCBalBefore),
        //     checkJettonBalDecrease(senderCrvUSDWallet, senderCRVUSDBalBefore),
        //     // Sender triUSDPool balance should not changed
        //     checkJettonBalNotChanged(senderTriUSDWallet, senderTriUSDBalBefore),
        //     // Sender quaUSDPool balance should be increased
        //     checkJettonBalIncrease(senderQuaUSDWallet, senderQuaUSDBalBefore),
        //   ]);
        // });

        it('should deposit USDC to triUSDPool and QuaUSDPool', async () => {
          // Build deposit params
          const depositParams: DepositParams = {
            pool: triUSDPool.address,
            depositAmounts: new Allocation({ asset: PoolAssets.USDC, value: toUnit(1, Decimals.USDT) }),
            nextDeposit: {
              pool: quaUSDPool.address,
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);
          await send(sendDepositArgs);

          await Promise.all([
            // Sender USDC balance should be decreased
            checkJettonBalDecrease(senderUSDCWallet, senderUSDCBalBefore),
            // Sender triUSDPool balance should not changed
            checkJettonBalNotChanged(senderTriUSDWallet, senderTriUSDBalBefore),
            // Sender quaUSDPool balance should be increased
            checkJettonBalIncrease(senderQuaUSDWallet, senderQuaUSDBalBefore),
          ]);
        });
      });

      describe('With meta asset', () => {
        it('should deposit USDC and SCRV_USD to triUSDPool and QuaUSDPool', async () => {
          // Build deposit params
          const depositParams: DepositParams = {
            pool: triUSDPool.address,
            depositAmounts: Allocation.createAllocations([{ asset: PoolAssets.USDC, value: toUnit(1, Decimals.USDT) }]),
            nextDeposit: {
              pool: quaUSDPool.address,
              depositAmounts: new Allocation({
                asset: PoolAssets.SCRV_USD,
                value: toUnit(1, Decimals.SCRV_USD),
              }),
            },
          };

          // Send deposit
          const sendDepositArgs = await getPayload(sender, depositParams);
          await send(sendDepositArgs);

          await Promise.all([
            // Sender USDC balance should be decreased
            checkJettonBalDecrease(senderUSDCWallet, senderUSDCBalBefore),
            // Sender SCRV_USD balance should be decreased
            checkJettonBalDecrease(senderScrvUSDWallet, senderSCRVUSDBalBefore),
            // Sender triUSDPool balance should not changed
            checkJettonBalNotChanged(senderTriUSDWallet, senderTriUSDBalBefore),
            // Sender quaUSDPool balance should be increased
            checkJettonBalIncrease(senderQuaUSDWallet, senderQuaUSDBalBefore),
          ]);
        });

        // it('should deposit USDT, CRV_USD and SCRV_USD to triUSDPool and QuaUSDPool', async () => {
        //   // Build deposit params
        //   const depositParams: DepositParams = {
        //     pool: triUSDPool.address,
        //     depositAmounts: Allocation.createAllocations([
        //       { asset: PoolAssets.USDT, value: toUnit(1, Decimals.USDT) },
        //       { asset: PoolAssets.CRV_USD, value: toUnit(1, Decimals.CRV_USD) },
        //     ]),
        //     nextDeposit: {
        //       pool: quaUSDPool.address,
        //       depositAmounts: new Allocation({
        //         asset: PoolAssets.SCRV_USD,
        //         value: toUnit(1, Decimals.SCRV_USD),
        //       }),
        //     },
        //   };

        //   // Send deposit
        //   const sendDepositArgs = await getPayload(sender, depositParams);
        //   await send(sendDepositArgs);

        //   await Promise.all([
        //     // Sender USDT balance should be decreased
        //     checkJettonBalDecrease(senderUSDTWallet, senderUSDTBalBefore),

        //     // Sender CRV_USD balance should be decreased
        //     checkJettonBalDecrease(senderCrvUSDWallet, senderCRVUSDBalBefore),

        //     // Sender SCRV_USD balance should be decreased
        //     checkJettonBalDecrease(senderScrvUSDWallet, senderSCRVUSDBalBefore),

        //     // Sender triUSDPool balance should not changed
        //     checkJettonBalNotChanged(senderTriUSDWallet, senderTriUSDBalBefore),

        //     // Sender quaUSDPool balance should be increased
        //     checkJettonBalIncrease(senderQuaUSDWallet, senderQuaUSDBalBefore),
        //   ]);
        // });
      });
    });
  }

  describe('Cancel Deposit in LpAccount', () => {
    let providerUSDTWallet: SandboxContract<JettonWallet>;
    let providerUSDCWallet: SandboxContract<JettonWallet>;
    let providerCRVUSDWallet: SandboxContract<JettonWallet>;
    let providerUSDTBalBefore = 0n;
    let providerUSDCBalBefore = 0n;
    let providerCRVUSDBalBefore = 0n;

    beforeEach(async () => {
      providerUSDTWallet = blockchain.openContract(
        JettonWallet.create(Address.parse('kQC6EYcRVg2-gTMbOxDLDmPJkdyPMo5eUMe5RYoyzAMlSQAB')),
      );
      providerUSDTBalBefore = await providerUSDTWallet.getBalance();
      providerUSDCWallet = blockchain.openContract(
        JettonWallet.create(Address.parse('kQDOCF86ut46U_aOl1kMkb27RIbGUqqK7zws-Rmu93p0CgKW')),
      );
      providerUSDCBalBefore = await providerUSDCWallet.getBalance();
      providerCRVUSDWallet = blockchain.openContract(
        JettonWallet.create(Address.parse('kQC6EYcRVg2-gTMbOxDLDmPJkdyPMo5eUMe5RYoyzAMlSQAB')),
      );
      providerCRVUSDBalBefore = await providerCRVUSDWallet.getBalance();
    });

    it('should cancel deposit in LpAccount without meta asset', async () => {
      const lpAccount = blockchain.openContract(
        LpAccount.createFromAddress(Address.parse('kQBuvm93yb4HshNJINyfcO6sYFVDjDbXoys8PJOMTtb8u-g2')),
      );
      const lpAccountData = await lpAccount.getLpAccountData();
      const depositedAssetCount = lpAccountData.currentBalances.filter((balance) => balance.value > 0n).length;
      const cancelDepositArgs = await lpAccount.getCancelDepositPayload(depositedAssetCount);
      await blockchain.sendMessage(
        internal({
          from: lpAccountData.providerAddress,
          to: cancelDepositArgs.to,
          value: cancelDepositArgs.value,
          body: cancelDepositArgs.body!,
        }),
      );

      // Provider USDT balance should be increased
      await checkJettonBalIncrease(providerUSDTWallet, providerUSDTBalBefore);

      // Provider USDC balance should be increased
      await checkJettonBalIncrease(providerUSDCWallet, providerUSDCBalBefore);
    });

    it('should cancel deposit in LpAccount with meta asset', async () => {
      const lpAccount = blockchain.openContract(
        LpAccount.createFromAddress(Address.parse('0QDoOiiY7R5tHgo47qVYJzVwKR-LDqef8__TKrLdfwSB46HL')),
      );
      const lpAccountData = await lpAccount.getLpAccountData();
      const depositedAssetCount = lpAccountData.currentBalances.filter((balance) => balance.value > 0n).length;
      const cancelDepositArgs = await lpAccount.getCancelDepositPayload(depositedAssetCount);
      await blockchain.sendMessage(
        internal({
          from: lpAccountData.providerAddress,
          to: cancelDepositArgs.to,
          value: cancelDepositArgs.value,
          body: cancelDepositArgs.body!,
        }),
      );

      // Provider USDT balance should be increased
      await checkJettonBalIncrease(providerUSDTWallet, providerUSDTBalBefore);

      // Provider USDC balance should be increased
      await checkJettonBalIncrease(providerUSDCWallet, providerUSDCBalBefore);

      // Provider CRV_USD balance should be increased
      await checkJettonBalIncrease(providerCRVUSDWallet, providerCRVUSDBalBefore);
    });
  });

  Promise.all([
    createDepositTests('Deposit Tests (Simulation)', async (sender, params) => {
      const simulateResponse = await torchSDK.simulateDeposit(params);
      return await simulateResponse.getDepositPayload(sender, { blockNumber });
    }),

    // createDepositTests('Deposit Tests (Direct)', (sender, params) =>
    //   torchSDK.getDepositPayload(sender, params, { blockNumber }),
    // ),
  ]);
});
