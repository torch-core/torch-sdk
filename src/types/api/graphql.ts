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
        currencyId
        id
        jettonMaster
        type
        }
        decimals
    }
    basePool {
        address
        type
        useRates
        lpAsset {
        asset {
            currencyId
            id
            jettonMaster
            type
        }
        decimals
        }
        assets {
        asset {
            currencyId
            id
            jettonMaster
            type
        }
        decimals
        }
    }
    lpAsset {
        asset {
        currencyId
        id
        jettonMaster
        type
        }
        decimals
    }
    }
}
        `,
};
