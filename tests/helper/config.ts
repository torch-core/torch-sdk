import { Address } from '@ton/core';
import { Asset } from '@torch-finance/core';

export abstract class FactoryConfig {
  static readonly FACTORY_ADDRESS = Address.parse('EQDwc-SpKN-OWtossgICrQ9bXRuF03LAKnivbZM19DUx2mPP');
}

export abstract class PoolConfig {
  static readonly TRI_TON_POOL_ADDRESS = Address.parse('EQDUb8w_eYHG76W0J8CRigX1kcvC3j7iOUSTQwkVYXizmHg4');
  static readonly QUA_TON_POOL_ADDRESS = Address.parse('EQDm65ai1Xw3BRs6xKBuAxqYmyR2q8KTPUFubL6gZ8_HeUxD');
  static readonly TRI_USD_POOL_ADDRESS = Address.parse('EQCRpkDXpfnSFASzzVtSJWyCVkMq29pApoRZQfVExo1lm_aX');
  static readonly QUA_USD_POOL_ADDRESS = Address.parse('EQBiifp1zwfPloZrLrLuhAQ8igTVnOiwCHxEsppV1T6dC0Ns');
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
}

export abstract class MockSettings {
  static readonly emulateBlockSeq = 28112908;
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
