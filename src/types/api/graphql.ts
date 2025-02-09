export type GraphQLResponse<T> = {
  data: T;
};

export const GqlQuery = {
  SDK_SYNC_POOLS: `
query SDK_SYNC_POOLS {
  pools {
    type
    address
    useRates
    assets {
      asset {
        id
        type
        currencyId
        jettonMaster
        decimals
      }
    }
    lpAsset {
      id
      type
      currencyId
      jettonMaster
      decimals
    }
    basePool {
      type
      address
      useRates
      address
      assets {
        asset {
          id
          currencyId
          jettonMaster
          type
          decimals
        }
      }
      lpAsset {
        id
        type
        currencyId
        jettonMaster
        decimals
      }
    }
  }
}
        `,
};
