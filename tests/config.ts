import { Address } from '@ton/core';
import { Asset } from '@torch-finance/core';

export abstract class FactoryConfig {
  static readonly factoryAddress = Address.parse('EQBO9Xw9w0hJQx4kw3RSKu2LROZbtKg4icITKYp5enCQVGCu');
}

export abstract class PoolConfig {
  static readonly TRI_TON_POOL_ADDRESS = Address.parse('EQCEao02tugbZjudFRMfyu2s_nVZli7F_rgxC1OjdvXpsBsw');
  static readonly QUA_TON_POOL_ADDRESS = Address.parse('EQA4rUktNrzOmgZ4OzsOX5Q-C1KelFPCtH8ln2YaHgyAO4kc');
  static readonly TRI_USD_POOL_ADDRESS = Address.parse('EQCP0zt6jVBBQrfuVQv2mkGxTx644BY0givW2BskBkJ7oQoN');
  static readonly QUA_USD_POOL_ADDRESS = Address.parse('EQDNrykzaG7kEzmqa0H7nRRudU8EtzDSzYVQ8QEPslOgwDG8');
}

export abstract class PoolAssets {
  static readonly TON_ASSET = Asset.ton();
  static readonly TS_TON_ASSET = Asset.jetton('EQA5rOnkPx8xTWvSjKAqEkdLOIM0-IyT_u-5IEQ5R2y9m-36');
  static readonly ST_TON_ASSET = Asset.jetton('EQBbKadthJqQfnEsijYFvi25AKGDhS3CTVAf8oGZYwGk8G8W');
  static readonly TRI_TON_ASSET = Asset.jetton(PoolConfig.TRI_TON_POOL_ADDRESS);
  static readonly HTON_ASSET = Asset.jetton('EQDInlQkBcha9-KPGDR-eWi5VGhYPXO5s04amtzZ07s0Kzuu');
  static readonly QUA_TON_ASSET = Asset.jetton(PoolConfig.QUA_TON_POOL_ADDRESS);
  static readonly USDT_ASSET = Asset.jetton(Address.parse('EQBflht80hwbivqv3Hnlhigqfe4RdY4Kb-LSOVldvGBsAgOQ'));
  static readonly USDC_ASSET = Asset.jetton(Address.parse('EQARxQlZfQUxhTcCRg4QraCtxmvw1GoGOeEanbcc55wLZg3E'));
  static readonly CRV_USD_ASSET = Asset.jetton(Address.parse('EQC76HKO16zcESvqLzDXpV98uRNiPDl_TO-g6794VMDGbbNZ'));
  static readonly SCRV_USD_ASSET = Asset.jetton(Address.parse('EQBN8qMhmCS2yj9a7KqRJTGPv8AZmfsBnRrw3ClODwpyus8v'));
}

export abstract class MockSettings {
  static readonly emulateBlockSeq = 27478252;
  static readonly sender = Address.parse('0QAHg-2Oy8Mc2BfENEaBcoDNXvHCu7mc28KkPIks8ZVqwmzg');
}

export abstract class Decimals {
  static readonly TON_DECIMALS = 9;
  static readonly TS_TON_DECIMALS = 9;
  static readonly ST_TON_DECIMALS = 9;
  static readonly HTON_DECIMALS = 9;
  static readonly USDT_DECIMALS = 6;
  static readonly USDC_DECIMALS = 6;
  static readonly CRV_USD_DECIMALS = 18;
  static readonly SCRV_USD_DECIMALS = 18;
  static readonly TRI_TON_DECIMALS = 18;
  static readonly QUA_TON_DECIMALS = 18;
  static readonly TRI_USD_DECIMALS = 18;
  static readonly QUA_USD_DECIMALS = 18;
}
