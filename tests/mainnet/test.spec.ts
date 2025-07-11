import { Blockchain, BlockchainSnapshot } from '@ton/sandbox';
import { TorchSDK, WithdrawParams } from '../../src';
import { Address, beginCell, toNano } from '@ton/ton';
import { PoolAddresses, PoolAssets } from './helper/config';
import { initialize, send } from './helper/blockchain';
import { getJettonBalances, getTonBalance } from './helper/balance';
import { Allocation } from '@torch-finance/core';

describe('TODO: Add Mainnet Testcases', () => {
  jest.setTimeout(30000);
  let torchSDK: TorchSDK;
  let blockchain: Blockchain;
  let snapshot: BlockchainSnapshot;
  const myWalletAddr = Address.parse('UQChc1fIWCxkvP58259wiX9qLjCn0c2ZwCO9cVmL3EkZi0MN');

  beforeAll(async () => {
    torchSDK = new TorchSDK({});
    blockchain = await initialize();
    snapshot = await blockchain.snapshot();
  });

  beforeEach(async () => {
    await blockchain.loadFrom(snapshot);
  });

  describe('Deposit', () => {
    it('should deposit all to triTON pool', async () => {
      // Get sender triTON LP balance before deposit
      const triTonLpBalBefore = (
        await getJettonBalances(blockchain, [PoolAssets.TRI_TON.jettonMaster!], myWalletAddr)
      )[0];

      // Start to deposit
      const amountToDeposit = toNano('0.01');
      const depositArgs = await torchSDK.getDepositPayload(myWalletAddr, {
        depositAmounts: Allocation.createAllocations([
          { asset: PoolAssets.TS_TON, value: amountToDeposit },
          { asset: PoolAssets.ST_TON, value: amountToDeposit },
          { asset: PoolAssets.TON, value: amountToDeposit },
        ]),
        pool: PoolAddresses.TRI_TON_POOL_ADDRESS,
        recipient: myWalletAddr,
        fulfillPayload: beginCell().storeUint(0, 32).endCell(),
      });
      await send(blockchain, myWalletAddr, depositArgs);

      // Get sender triTON LP balance after deposit
      const triTonLpBalAfter = (
        await getJettonBalances(blockchain, [PoolAssets.TRI_TON.jettonMaster!], myWalletAddr)
      )[0];

      // triTonLpBalAfter should be increased
      expect(triTonLpBalAfter).toBeGreaterThan(triTonLpBalBefore);
    });

    it('should deposit only TON to triTON pool', async () => {
      // Get sender triTON LP balance before deposit
      const triTonLpBalBefore = (
        await getJettonBalances(blockchain, [PoolAssets.TRI_TON.jettonMaster!], myWalletAddr)
      )[0];

      // Start to deposit
      const amountToDeposit = toNano('0.01');
      const depositArgs = await torchSDK.getDepositPayload(myWalletAddr, {
        depositAmounts: Allocation.createAllocations([{ asset: PoolAssets.TON, value: amountToDeposit }]),
        pool: PoolAddresses.TRI_TON_POOL_ADDRESS,
      });
      await send(blockchain, myWalletAddr, depositArgs);

      // Get sender triTON LP balance after deposit
      const triTonLpBalAfter = (
        await getJettonBalances(blockchain, [PoolAssets.TRI_TON.jettonMaster!], myWalletAddr)
      )[0];

      // triTonLpBalAfter should be increased
      expect(triTonLpBalAfter).toBeGreaterThan(triTonLpBalBefore);
    });

    it('should deposit only tsTON to triTON pool', async () => {
      // Get sender triTON LP balance before deposit
      const triTonLpBalBefore = (
        await getJettonBalances(blockchain, [PoolAssets.TRI_TON.jettonMaster!], myWalletAddr)
      )[0];

      // Start to deposit
      const amountToDeposit = toNano('0.01');
      const depositArgs = await torchSDK.getDepositPayload(myWalletAddr, {
        depositAmounts: Allocation.createAllocations([{ asset: PoolAssets.TS_TON, value: amountToDeposit }]),
        pool: PoolAddresses.TRI_TON_POOL_ADDRESS,
      });
      await send(blockchain, myWalletAddr, depositArgs);

      // Get sender triTON LP balance after deposit
      const triTonLpBalAfter = (
        await getJettonBalances(blockchain, [PoolAssets.TRI_TON.jettonMaster!], myWalletAddr)
      )[0];

      // triTonLpBalAfter should be increased
      expect(triTonLpBalAfter).toBeGreaterThan(triTonLpBalBefore);
    });

    it('should deposit TON and tsTON to triTON pool', async () => {
      // Get sender triTON LP balance before deposit
      const triTonLpBalBefore = (
        await getJettonBalances(blockchain, [PoolAssets.TRI_TON.jettonMaster!], myWalletAddr)
      )[0];

      // Start to deposit
      const amountToDeposit = toNano('0.01');
      const depositArgs = await torchSDK.getDepositPayload(myWalletAddr, {
        depositAmounts: Allocation.createAllocations([
          { asset: PoolAssets.TS_TON, value: amountToDeposit },
          { asset: PoolAssets.TON, value: amountToDeposit },
        ]),
        pool: PoolAddresses.TRI_TON_POOL_ADDRESS,
      });
      await send(blockchain, myWalletAddr, depositArgs);

      // Get sender triTON LP balance after deposit
      const triTonLpBalAfter = (
        await getJettonBalances(blockchain, [PoolAssets.TRI_TON.jettonMaster!], myWalletAddr)
      )[0];

      // triTonLpBalAfter should be increased
      expect(triTonLpBalAfter).toBeGreaterThan(triTonLpBalBefore);
    });

    it('should deposit stTON and tsTON to triTON pool', async () => {
      // Get sender triTON LP balance before deposit
      const triTonLpBalBefore = (
        await getJettonBalances(blockchain, [PoolAssets.TRI_TON.jettonMaster!], myWalletAddr)
      )[0];

      // Start to deposit
      const amountToDeposit = toNano('0.01');
      const depositArgs = await torchSDK.getDepositPayload(myWalletAddr, {
        depositAmounts: Allocation.createAllocations([
          { asset: PoolAssets.ST_TON, value: amountToDeposit },
          { asset: PoolAssets.TS_TON, value: amountToDeposit },
        ]),
        pool: PoolAddresses.TRI_TON_POOL_ADDRESS,
      });
      await send(blockchain, myWalletAddr, depositArgs);

      // Get sender triTON LP balance after deposit
      const triTonLpBalAfter = (
        await getJettonBalances(blockchain, [PoolAssets.TRI_TON.jettonMaster!], myWalletAddr)
      )[0];

      // triTonLpBalAfter should be increased
      expect(triTonLpBalAfter).toBeGreaterThan(triTonLpBalBefore);
    });
  });

  describe('Swap', () => {
    it('should swap tsTON to stTON', async () => {
      // Get sender tsTON and stTON balance before swap
      const jettonBalanceBefore = await getJettonBalances(
        blockchain,
        [PoolAssets.TS_TON.jettonMaster!, PoolAssets.ST_TON.jettonMaster!],
        myWalletAddr,
      );
      const tsTonBalBefore = jettonBalanceBefore[0];
      const stTonBalBefore = jettonBalanceBefore[1];

      // Start to swap
      const senderArg = await torchSDK.getSwapPayload(myWalletAddr, {
        mode: 'ExactIn',
        assetIn: PoolAssets.TS_TON,
        assetOut: PoolAssets.ST_TON,
        amountIn: toNano('0.05'),
        deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 60),
        fulfillPayload: beginCell().storeUint(0, 32).endCell(),
      });

      await send(blockchain, myWalletAddr, senderArg);

      // Get sender tsTON and stTON balance after swap
      const balanceAfter = await getJettonBalances(
        blockchain,
        [PoolAssets.TS_TON.jettonMaster!, PoolAssets.ST_TON.jettonMaster!],
        myWalletAddr,
      );
      const tsTonBalAfter = balanceAfter[0];
      const stTonBalAfter = balanceAfter[1];

      // Check if tsTON balance decreased
      expect(tsTonBalAfter).toBeLessThan(tsTonBalBefore);

      // Check if stTON balance increased
      expect(stTonBalAfter).toBeGreaterThan(stTonBalBefore);
    });
  });

  describe('Withdraw', () => {
    it('should withdraw all from triTON pool', async () => {
      // Get sender triTON LP, stTON, tsTON balance before withdraw
      const jettonBalanceBefore = await getJettonBalances(
        blockchain,
        [PoolAssets.TRI_TON.jettonMaster!, PoolAssets.ST_TON.jettonMaster!, PoolAssets.TS_TON.jettonMaster!],
        myWalletAddr,
      );
      const triTonLpBalBefore = jettonBalanceBefore[0];
      const stTonBalBefore = jettonBalanceBefore[1];
      const tsTonBalBefore = jettonBalanceBefore[2];

      // Get sender TON balance before withdraw
      const tonBalBefore = await getTonBalance(blockchain, myWalletAddr);

      // Start to withdraw
      const burnLpAmount = 6n * 10n ** 16n; // 0.06 triTON Lp
      const withdrawParams: WithdrawParams = {
        mode: 'Balanced',
        pool: PoolAddresses.TRI_TON_POOL_ADDRESS,
        burnLpAmount,
        queryId: 1n,
      };

      const withdrawArgs = await torchSDK.getWithdrawPayload(myWalletAddr, withdrawParams);
      await send(blockchain, myWalletAddr, withdrawArgs);

      // Get sender triTON LP, stTON, tsTON balance after withdraw
      const jettonBalanceAfter = await getJettonBalances(
        blockchain,
        [PoolAssets.TRI_TON.jettonMaster!, PoolAssets.ST_TON.jettonMaster!, PoolAssets.TS_TON.jettonMaster!],
        myWalletAddr,
      );
      const triTonLpBalAfter = jettonBalanceAfter[0];
      const stTonBalAfter = jettonBalanceAfter[1];
      const tsTonBalAfter = jettonBalanceAfter[2];

      // Get sender TON balance after withdraw
      const tonBalAfter = await getTonBalance(blockchain, myWalletAddr);

      // triTonLpBalAfter should be decreased by burnLpAmount
      expect(triTonLpBalAfter).toEqual(triTonLpBalBefore - burnLpAmount);

      // stTonBalAfter should be increased
      expect(stTonBalAfter).toBeGreaterThan(stTonBalBefore);

      // tsTonBalAfter should be increased
      expect(tsTonBalAfter).toBeGreaterThan(tsTonBalBefore);

      // tonBalAfter should be increased
      expect(tonBalAfter).toBeGreaterThan(tonBalBefore);
    });

    it('should withdraw only TON from triTON pool', async () => {
      // Get sender triTON LP balance before withdraw
      const triTonLpBalBefore = (
        await getJettonBalances(blockchain, [PoolAssets.TRI_TON.jettonMaster!], myWalletAddr)
      )[0];

      // Get sender TON balance before withdraw
      const tonBalBefore = await getTonBalance(blockchain, myWalletAddr);

      // Start to withdraw
      const burnLpAmount = 6n * 10n ** 16n; // 0.06 triTON Lp
      const withdrawParams: WithdrawParams = {
        mode: 'Single',
        withdrawAsset: PoolAssets.TON,
        pool: PoolAddresses.TRI_TON_POOL_ADDRESS,
        burnLpAmount,
        queryId: 1n,
      };

      const withdrawArgs = await torchSDK.getWithdrawPayload(myWalletAddr, withdrawParams);
      await send(blockchain, myWalletAddr, withdrawArgs);

      // Get sender triTON LP balance after withdraw
      const triTonLpBalAfter = (
        await getJettonBalances(blockchain, [PoolAssets.TRI_TON.jettonMaster!], myWalletAddr)
      )[0];

      // triTonLpBalAfter should be decreased by burnLpAmount
      expect(triTonLpBalAfter).toEqual(triTonLpBalBefore - burnLpAmount);

      // Get sender TON balance after withdraw
      const tonBalAfter = await getTonBalance(blockchain, myWalletAddr);

      // tonBalAfter should be increased
      expect(tonBalAfter).toBeGreaterThan(tonBalBefore);
    });

    it('should withdraw only stTON from triTON pool', async () => {
      // Get sender triTON LP, stTON balance before withdraw
      const jettonBalanceBefore = await getJettonBalances(
        blockchain,
        [PoolAssets.TRI_TON.jettonMaster!, PoolAssets.ST_TON.jettonMaster!],
        myWalletAddr,
      );
      const triTonLpBalBefore = jettonBalanceBefore[0];
      const stTonBalBefore = jettonBalanceBefore[1];

      // Start to withdraw
      const burnLpAmount = 6n * 10n ** 16n; // 0.06 triTON Lp
      const withdrawParams: WithdrawParams = {
        mode: 'Single',
        withdrawAsset: PoolAssets.ST_TON,
        pool: PoolAddresses.TRI_TON_POOL_ADDRESS,
        burnLpAmount,
      };

      const withdrawArgs = await torchSDK.getWithdrawPayload(myWalletAddr, withdrawParams);
      await send(blockchain, myWalletAddr, withdrawArgs);

      // Get sender triTON LP, stTON balance after withdraw
      const jettonBalanceAfter = await getJettonBalances(
        blockchain,
        [PoolAssets.TRI_TON.jettonMaster!, PoolAssets.ST_TON.jettonMaster!],
        myWalletAddr,
      );
      const triTonLpBalAfter = jettonBalanceAfter[0];
      const stTonBalAfter = jettonBalanceAfter[1];

      // triTonLpBalAfter should be decreased by burnLpAmount
      expect(triTonLpBalAfter).toEqual(triTonLpBalBefore - burnLpAmount);

      // stTonBalAfter should be increased
      expect(stTonBalAfter).toBeGreaterThan(stTonBalBefore);
    });
  });
});
