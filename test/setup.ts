import {
  Blockchain,
  internal,
  printTransactionFees,
  RemoteBlockchainStorage,
  wrapTonClient4ForRemote,
} from '@ton/sandbox';
import { JettonMaster, JettonWallet, SenderArguments, TonClient4 } from '@ton/ton';
import { TorchSDK } from '../src';
import { FactoryConfig, MockSettings, PoolAssets, PoolConfig } from './config';
import { Factory, Pool } from '@torch-finance/dex-contract-wrapper';

const endpoint = 'https://testnet-v4.tonhubapi.com';
const client = new TonClient4({ endpoint });
export const initialize = async () => {
  // Core blockchain and SDK initialization
  const blockchain = await Blockchain.create({
    storage: new RemoteBlockchainStorage(wrapTonClient4ForRemote(client), MockSettings.emulateBlockSeq),
  });
  const torchSDK = new TorchSDK({
    factoryAddress: FactoryConfig.factoryAddress,
    indexerEndpoint: 'http://localhost:3001',
    oracleEndpoint: 'https://testnet-oracle.torch.finance/',
  });

  // Initialize Sender
  const sender = MockSettings.sender;

  // Initialize Factory
  const factory = blockchain.openContract(Factory.createFromAddress(FactoryConfig.factoryAddress));

  // Initialize pools
  const triTONPool = blockchain.openContract(Pool.createFromAddress(PoolConfig.triTONPoolAddress));
  const quaTONPool = blockchain.openContract(Pool.createFromAddress(PoolConfig.quaTONPoolAddress));

  // Initialize Jetton Master
  const stTON = blockchain.openContract(JettonMaster.create(PoolAssets.stTONAsset.jettonMaster!));
  const tsTON = blockchain.openContract(JettonMaster.create(PoolAssets.tsTONAsset.jettonMaster!));
  const hTON = blockchain.openContract(JettonMaster.create(PoolAssets.hTONAsset.jettonMaster!));

  // Initialize Sender Jetton Wallets
  const senderStTONWallet = blockchain.openContract(
    JettonWallet.create(await stTON.getWalletAddress(MockSettings.sender)),
  );
  const senderTsTONWallet = blockchain.openContract(
    JettonWallet.create(await tsTON.getWalletAddress(MockSettings.sender)),
  );
  const senderHTONWallet = blockchain.openContract(
    JettonWallet.create(await hTON.getWalletAddress(MockSettings.sender)),
  );

  // Utility functions
  const send = async (args: SenderArguments[] | SenderArguments) => {
    if (!Array.isArray(args)) {
      args = [args];
    }
    for (const arg of args) {
      const r = await blockchain.sendMessage(
        internal({
          from: MockSettings.sender,
          to: arg.to,
          value: arg.value,
          body: arg.body!,
        }),
      );
      printTransactionFees(r.transactions);
    }
  };

  return {
    torchSDK,
    blockchain,
    sender,
    factory,
    triTONPool,
    quaTONPool,
    stTON,
    tsTON,
    hTON,
    senderStTONWallet,
    senderTsTONWallet,
    senderHTONWallet,
    send,
  };
};
