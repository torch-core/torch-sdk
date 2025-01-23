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
        description
        image
        name
        symbol
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
        description
        image
        name
        symbol
        }
        assets {
        asset {
            currencyId
            id
            jettonMaster
            type
        }
        decimals
        description
        name
        symbol
        image
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
        description
        name
        symbol
        image
    }
    }
}
        `,
};
