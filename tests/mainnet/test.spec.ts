import { Blockchain } from '@ton/sandbox';
import { TorchSDK } from '../../src';
import { Address, beginCell, toNano } from '@ton/ton';
import { PoolAssets } from './helper/config';
import { initialize, send } from './helper/blockchain';
import { getJettonBalances } from './helper/balance';

describe('TODO: Add Mainnet Testcases', () => {
  jest.setTimeout(30000);
  let torchSDK: TorchSDK;
  let blockchain: Blockchain;
  const myWalletAddr = Address.parse('UQChc1fIWCxkvP58259wiX9qLjCn0c2ZwCO9cVmL3EkZi0MN');

  beforeAll(async () => {
    torchSDK = new TorchSDK({});
    blockchain = await initialize();
  });

  it('should swap', async () => {
    // Get sender tsTON and stTON balance before swap
    const balanceBefore = await getJettonBalances(
      blockchain,
      [PoolAssets.TS_TON.jettonMaster!, PoolAssets.ST_TON.jettonMaster!],
      myWalletAddr,
    );
    const tsTonBalBefore = balanceBefore[0];
    const stTonBalBefore = balanceBefore[1];

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
