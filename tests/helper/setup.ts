import { Blockchain, internal, RemoteBlockchainStorage, wrapTonClient4ForRemote } from '@ton/sandbox';
import { JettonMaster, JettonWallet, SenderArguments, toNano, TonClient4 } from '@ton/ton';
import { SwapParams, TorchSDK } from '../../src';
import { FactoryConfig, MockSettings, PoolAssets, PoolConfig } from './config';
import { Factory, Pool } from '@torch-finance/dex-contract-wrapper';
import { Asset } from '@torch-finance/core';

const endpoint = 'https://testnet-v4.tonhubapi.com';
const client = new TonClient4({ endpoint });
export const initialize = async () => {
  // Core blockchain and SDK initialization
  const blockchain = await Blockchain.create({
    storage: new RemoteBlockchainStorage(wrapTonClient4ForRemote(client), MockSettings.emulateBlockSeq),
  });

  const torchSDK = new TorchSDK({
    factoryAddress: FactoryConfig.factoryAddress,
    apiEndpoint: 'https://testnet-api-server-asia-1074685515738.asia-east1.run.app',
    oracleEndpoint: 'https://testnet-oracle-1074685515738.asia-east1.run.app',
  });

  // Initialize Sender
  const sender = MockSettings.sender;

  // Initialize Factory
  const factory = blockchain.openContract(Factory.createFromAddress(FactoryConfig.factoryAddress));

  // Initialize pools
  const triTONPool = blockchain.openContract(Pool.createFromAddress(PoolConfig.TRI_TON_POOL_ADDRESS));
  const quaTONPool = blockchain.openContract(Pool.createFromAddress(PoolConfig.QUA_TON_POOL_ADDRESS));
  const triUSDPool = blockchain.openContract(Pool.createFromAddress(PoolConfig.TRI_USD_POOL_ADDRESS));
  const quaUSDPool = blockchain.openContract(Pool.createFromAddress(PoolConfig.QUA_USD_POOL_ADDRESS));

  // Initialize Jetton Master
  const stTON = blockchain.openContract(JettonMaster.create(PoolAssets.ST_TON_ASSET.jettonMaster!));
  const tsTON = blockchain.openContract(JettonMaster.create(PoolAssets.TS_TON_ASSET.jettonMaster!));
  const hTON = blockchain.openContract(JettonMaster.create(PoolAssets.HTON_ASSET.jettonMaster!));
  const USDT = blockchain.openContract(JettonMaster.create(PoolAssets.USDT_ASSET.jettonMaster!));
  const USDC = blockchain.openContract(JettonMaster.create(PoolAssets.USDC_ASSET.jettonMaster!));
  const CRV_USD = blockchain.openContract(JettonMaster.create(PoolAssets.CRV_USD_ASSET.jettonMaster!));
  const SCRV_USD = blockchain.openContract(JettonMaster.create(PoolAssets.SCRV_USD_ASSET.jettonMaster!));

  // Initialize Sender Jetton Wallets using Promise.all
  const [
    senderStTONWallet,
    senderTsTONWallet,
    senderHTONWallet,
    senderUSDTWallet,
    senderUSDCWallet,
    senderCrvUSDWallet,
    senderScrvUSDWallet,
    senderTriTONWallet,
    senderQuaTONWallet,
    senderTriUSDWallet,
    senderQuaUSDWallet,
  ] = await Promise.all([
    stTON
      .getWalletAddress(MockSettings.sender)
      .then((address) => blockchain.openContract(JettonWallet.create(address))),
    tsTON
      .getWalletAddress(MockSettings.sender)
      .then((address) => blockchain.openContract(JettonWallet.create(address))),
    hTON.getWalletAddress(MockSettings.sender).then((address) => blockchain.openContract(JettonWallet.create(address))),
    USDT.getWalletAddress(MockSettings.sender).then((address) => blockchain.openContract(JettonWallet.create(address))),
    USDC.getWalletAddress(MockSettings.sender).then((address) => blockchain.openContract(JettonWallet.create(address))),
    CRV_USD.getWalletAddress(MockSettings.sender).then((address) =>
      blockchain.openContract(JettonWallet.create(address)),
    ),
    SCRV_USD.getWalletAddress(MockSettings.sender).then((address) =>
      blockchain.openContract(JettonWallet.create(address)),
    ),
    triTONPool
      .getWalletAddress(MockSettings.sender)
      .then((address) => blockchain.openContract(JettonWallet.create(address))),
    quaTONPool
      .getWalletAddress(MockSettings.sender)
      .then((address) => blockchain.openContract(JettonWallet.create(address))),
    triUSDPool
      .getWalletAddress(MockSettings.sender)
      .then((address) => blockchain.openContract(JettonWallet.create(address))),
    quaUSDPool
      .getWalletAddress(MockSettings.sender)
      .then((address) => blockchain.openContract(JettonWallet.create(address))),
  ]);

  const blockNumber = MockSettings.emulateBlockSeq;
  // Utility functions
  const send = async (args: SenderArguments[] | SenderArguments) => {
    if (!Array.isArray(args)) {
      args = [args];
    }
    for (const arg of args) {
      await blockchain.sendMessage(
        internal({
          from: MockSettings.sender,
          to: arg.to,
          value: arg.value,
          body: arg.body!,
        }),
      );
    }
  };

  const swapImpactTriTON = async (
    assetIn: Asset = PoolAssets.TS_TON_ASSET,
    assetOut: Asset = PoolAssets.ST_TON_ASSET,
    amountIn: bigint = toNano('0.5'),
  ) => {
    const swapFluctuateParams: SwapParams = {
      mode: 'ExactIn',
      assetIn,
      assetOut,
      amountIn,
    };
    const sendFluctuateArgs = await torchSDK.getSwapPayload(sender, swapFluctuateParams);
    await send(sendFluctuateArgs);
  };

  const swapImpactQuaTON = async (
    assetIn: Asset = PoolAssets.TRI_TON_ASSET,
    assetOut: Asset = PoolAssets.HTON_ASSET,
    amountIn: bigint = 1n * 10n ** 18n,
  ) => {
    const swapFluctuateParams: SwapParams = {
      mode: 'ExactIn',
      assetIn,
      assetOut,
      amountIn,
    };
    const sendFluctuateArgs = await torchSDK.getSwapPayload(sender, swapFluctuateParams);
    await send(sendFluctuateArgs);
  };

  return {
    torchSDK,
    blockchain,
    sender,
    factory,
    triTONPool,
    quaTONPool,
    triUSDPool,
    quaUSDPool,
    stTON,
    tsTON,
    hTON,
    USDT,
    USDC,
    CRV_USD,
    SCRV_USD,
    senderStTONWallet,
    senderTsTONWallet,
    senderHTONWallet,
    senderUSDTWallet,
    senderUSDCWallet,
    senderCrvUSDWallet,
    senderScrvUSDWallet,
    senderTriTONWallet,
    senderQuaTONWallet,
    senderTriUSDWallet,
    senderQuaUSDWallet,
    send,
    swapImpactTriTON,
    swapImpactQuaTON,
    blockNumber,
  };
};
