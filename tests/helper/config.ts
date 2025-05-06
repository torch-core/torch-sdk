import { Address } from '@ton/core';
import { Asset } from '@torch-finance/core';

export abstract class FactoryConfig {
  static readonly FACTORY_ADDRESS = Address.parse('EQCNvyhu-VxeL7i-Uk5Uu0m7TO0qQaWQlHmGOUyUh1hoF7au');
}

export abstract class PoolConfig {
  static readonly TRI_TON_POOL_ADDRESS = Address.parse('EQB2iUVMu3yffZO9sAG3xadzXgdPPl43MaXK9s8Hd8xQgQFO');
  static readonly QUA_TON_POOL_ADDRESS = Address.parse('EQByR2K2VfLPgqymDpL-laP73TmC_p5T5l12GohWfyMcJiAR');
  static readonly TRI_USD_POOL_ADDRESS = Address.parse('EQDd3tIi7KiZOvMUSuFMcLf0-mpMxzcl0C7wbR7n74rjjiPh');
  static readonly QUA_USD_POOL_ADDRESS = Address.parse('EQCzRegVehAdD5EdipiV-1rCGCM9RefcHL4NYMp9m60M_ApQ');
  static readonly TGUSD_USDT_POOL = Address.parse('EQDgiSowOPf0jBQHzTAoy9Xufi78MebQFLJepimJ2z6L9u5l');
  static readonly STGUSD_TGUSD_POOL = Address.parse('EQB2-6yKBXGr8iPY6hLt6fqsAF43AJ4x6FVghp5wJTh6JaBu');
}

export abstract class PoolAssets {
  static readonly TON = Asset.ton();
  static readonly TS_TON = Asset.jetton('EQA5rOnkPx8xTWvSjKAqEkdLOIM0-IyT_u-5IEQ5R2y9m-36');
  static readonly ST_TON = Asset.jetton('EQBbKadthJqQfnEsijYFvi25AKGDhS3CTVAf8oGZYwGk8G8W');
  static readonly TRI_TON = Asset.jetton(PoolConfig.TRI_TON_POOL_ADDRESS);
  static readonly H_TON = Asset.jetton('EQDInlQkBcha9-KPGDR-eWi5VGhYPXO5s04amtzZ07s0Kzuu');
  static readonly QUA_TON = Asset.jetton(PoolConfig.QUA_TON_POOL_ADDRESS);
  static readonly USDT = Asset.jetton(Address.parse('EQBflht80hwbivqv3Hnlhigqfe4RdY4Kb-LSOVldvGBsAgOQ'));
  static readonly USDC = Asset.jetton(Address.parse('EQARxQlZfQUxhTcCRg4QraCtxmvw1GoGOeEanbcc55wLZg3E'));
  static readonly CRV_USD = Asset.jetton(Address.parse('EQC76HKO16zcESvqLzDXpV98uRNiPDl_TO-g6794VMDGbbNZ'));
  static readonly SCRV_USD = Asset.jetton(Address.parse('EQBN8qMhmCS2yj9a7KqRJTGPv8AZmfsBnRrw3ClODwpyus8v'));
  static readonly TRI_USD = Asset.jetton(PoolConfig.TRI_USD_POOL_ADDRESS);
  static readonly QUA_USD = Asset.jetton(PoolConfig.QUA_USD_POOL_ADDRESS);
  static readonly TGUSD = Asset.jetton('EQCyeymJ7CwbDLzp7UA6RabIDpRGo34hQ1bXMLS9fllESSPB');
  static readonly STGUSD = Asset.jetton('EQDLoru6i-vGoYEfe7LHNdZlGyq77T78IMR7jbGyubZ5A5ZE');
}

export abstract class MockSettings {
  static readonly emulateBlockSeq = 30441616;
  static readonly sender = Address.parse('0QBtvbUwvUMHWiYt85cqAjtMSTOoDCufuBEhh7m6czZTn0wF');
}

export abstract class Decimals {
  static readonly TON = 9;
  static readonly TS_TON = 9;
  static readonly ST_TON = 9;
  static readonly HTON = 9;
  static readonly USDT = 6;
  static readonly USDC = 6;
  static readonly CRV_USD = 18;
  static readonly SCRV_USD = 18;
  static readonly TRI_TON = 18;
  static readonly QUA_TON = 18;
  static readonly TRI_USD = 18;
  static readonly QUA_USD = 18;
}
