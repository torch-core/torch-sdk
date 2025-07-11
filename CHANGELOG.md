# @torch-finance/sdk

## 1.4.1

### Patch Changes

- 1ca04f4: - Update the version of dex-contract-wrapper
  - Add basic tests for mainnet

## 1.4.0

### Minor Changes

- 6bae0fd: Update referral key generation & size of extra payload

## 1.3.1

### Patch Changes

- 534ee94: Fix swap params still has extra payload and options miss the referral code

## 1.3.0

### Minor Changes

- a173d1c: Enable referral code in swap operations

## 1.2.4

### Patch Changes

- 5c65339: Update simulator version to 0.4.0

## 1.2.3

### Patch Changes

- 3b6f7f7: Added swap with routes method

## 1.2.2

### Patch Changes

- d8cc8ad: Update mainnet config

## 1.2.1

### Patch Changes

- 2eadcc5: - If there's no deposit or slippage is not specified, skip the simulation
  - Split calculateWithdrawMinAmountOuts into two separate functions

## 1.2.0

### Minor Changes

- cfd6a10: Update pool graphql format

## 1.1.0

### Minor Changes

- 35a32ab: Simulate Swap/Deposit/Withdraw: Now returns a getPayload function, allowing the transaction BOC to be retrieved directly after simulation, reducing redundant processes previously found in getPayload.

  Enhanced Testing: Added more tests and improved testing performance.

  Bug Fix: Fixed the issue where only pools using useRate were required to obtain signedRate from the oracle.

  External Pool Support: Allowed external provision and caching of pools, making it highly suitable for frontend applications.

## 1.0.0

### Major Changes

- 1420533: Release Torch SDK 1.0.0
