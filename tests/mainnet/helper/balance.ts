import { Address } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { JettonMaster, JettonWallet } from '@ton/ton';

// Utility function to get TON balance
export async function getTonBalance(blockchain: Blockchain, contractAddress: Address): Promise<bigint> {
  const contract = await blockchain.getContract(contractAddress);
  return contract.balance;
}

// Utility function to get multiple Jetton balances (array input, returns array in input order)
export async function getJettonBalances(
  blockchain: Blockchain,
  jettonMasterAddrs: Address | Address[],
  userAddress: Address,
): Promise<bigint[]> {
  const addrs = Array.isArray(jettonMasterAddrs) ? jettonMasterAddrs : [jettonMasterAddrs];

  const results = await Promise.all(
    addrs.map(async (jettonMasterAddr) => {
      try {
        const jettonMaster = blockchain.openContract(JettonMaster.create(jettonMasterAddr));
        const userWalletAddr = await jettonMaster.getWalletAddress(userAddress);
        const userWallet = blockchain.openContract(JettonWallet.create(userWalletAddr));
        return await userWallet.getBalance();
      } catch (error) {
        console.error(`Error fetching balance for ${jettonMasterAddr}:`, error);
        return 0n;
      }
    }),
  );

  return results;
}
