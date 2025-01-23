import { SandboxContract } from '@ton/sandbox';
import { TorchSDK } from '../src';
import { initialize } from './setup';
import { PoolAssets } from './config';
import { Address, SenderArguments, toNano } from '@ton/core';
import { SwapParams } from '../src/types/swap';
import { JettonWallet } from '@ton/ton';

describe('Swap Testcases', () => {
  // set timeout: 6 minutes
  jest.setTimeout(360000);

  let torchSDK: TorchSDK;
  let sender: Address;

  // Sender Jetton Wallet
  let senderStTONWallet: SandboxContract<JettonWallet>;
  let senderTsTONWallet: SandboxContract<JettonWallet>;
  //   let senderHTONWallet: SandboxContract<JettonWallet>;

  // Sender Asset Balance Before
  let senderStTONBalBefore: bigint;
  let senderTsTONBalBefore: bigint;
  //   let senderHTONBalBefore: bigint;

  // Send function
  let send: (args: SenderArguments[] | SenderArguments) => Promise<void>;
  beforeAll(async () => {
    ({
      torchSDK,
      //   blockchain,
      //   factory,
      sender,
      //   triTONPool,
      senderStTONWallet,
      senderTsTONWallet,
      //   senderHTONWallet,
      send,
    } = await initialize());
  });

  beforeEach(async () => {
    senderStTONBalBefore = await senderStTONWallet.getBalance();
    senderTsTONBalBefore = await senderTsTONWallet.getBalance();
    // senderHTONBalBefore = await senderHTONWallet.getBalance();
  });

  it('should swap tsTON to stTON', async () => {
    // Build swap paylaod
    const amountIn = toNano('0.05');
    const swapParams: SwapParams = {
      mode: 'ExactIn',
      assetIn: PoolAssets.tsTONAsset,
      assetOut: PoolAssets.stTONAsset,
      amountIn,
    };

    // Send swap
    const sendArgs = await torchSDK.getSwapPayload(sender, swapParams);
    await send(sendArgs);

    // Sender stTON balance should be increased
    const senderStTONBalAfter = await senderStTONWallet.getBalance();
    expect(senderStTONBalAfter).toBeGreaterThan(senderStTONBalBefore);

    // Sender tsTON balance should be decreased
    const senderTsTONBalAfter = await senderTsTONWallet.getBalance();
    expect(senderTsTONBalAfter).toBeLessThan(senderTsTONBalBefore);
  });
});
