---
'@torch-finance/sdk': minor
---

Simulate Swap/Deposit/Withdraw: Now returns a getPayload function, allowing the transaction BOC to be retrieved directly after simulation, reducing redundant processes previously found in getPayload.

Enhanced Testing: Added more tests and improved testing performance.

Bug Fix: Fixed the issue where only pools using useRate were required to obtain signedRate from the oracle.

External Pool Support: Allowed external provision and caching of pools, making it highly suitable for frontend applications.
