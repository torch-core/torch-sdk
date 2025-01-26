# @torch-finance/sdk

## 2.0.0

### Major Changes

- 8414dd8: Release Torch SDK 1.0.0

### Patch Changes

- 8414dd8: slightly enhance performance by updating resolvehops and get pools
- 8414dd8: Simulate Swap/Deposit/Withdraw: Now returns a getPayload function, allowing the transaction BOC to be retrieved directly after simulation, reducing redundant processes previously found in getPayload.

  Enhanced Testing: Added more tests and improved testing performance.

  Bug Fix: Fixed the issue where only pools using useRate were required to obtain signedRate from the oracle.

  External Pool Support: Allowed external provision and caching of pools, making it highly suitable for frontend applications.

## 1.0.0

### Major Changes

- 1420533: Release Torch SDK 1.0.0
