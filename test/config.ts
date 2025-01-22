import { Address } from '@ton/core';
import { Asset } from '@torch-finance/core';

export abstract class PoolConfig {
  static readonly triTONPoolAddress = Address.parse('EQCEao02tugbZjudFRMfyu2s_nVZli7F_rgxC1OjdvXpsBsw');
  static readonly quaTONPoolAddress = Address.parse('EQA4rUktNrzOmgZ4OzsOX5Q-C1KelFPCtH8ln2YaHgyAO4kc');
}

export abstract class PoolAssets {
  static readonly tonAsset = Asset.ton();
  static readonly tsTONAsset = Asset.jetton('EQA5rOnkPx8xTWvSjKAqEkdLOIM0-IyT_u-5IEQ5R2y9m-36');
  static readonly stTONAsset = Asset.jetton('EQBbKadthJqQfnEsijYFvi25AKGDhS3CTVAf8oGZYwGk8G8W');
  static readonly hTONAsset = Asset.jetton('EQDInlQkBcha9-KPGDR-eWi5VGhYPXO5s04amtzZ07s0Kzuu');
}
