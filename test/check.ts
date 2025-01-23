import { Blockchain, SandboxContract } from '@ton/sandbox';
import { Address, JettonWallet, toNano } from '@ton/ton';

// Check Jetton Balance Increase
export const checkJettonBalIncrease = async (
  jettonWallet: SandboxContract<JettonWallet>,
  balanceBefore: bigint,
  balanceChange: bigint = 0n,
) => {
  const balanceAfter = await jettonWallet.getBalance();
  if (balanceChange > 0n) {
    expect(balanceAfter).toBe(balanceBefore + balanceChange);
  } else {
    expect(balanceAfter).toBeGreaterThan(balanceBefore);
  }
};

// Check Jetton Balance Decrease
export const checkJettonBalDecrease = async (
  jettonWallet: SandboxContract<JettonWallet>,
  balanceBefore: bigint,
  balanceChange: bigint = 0n,
) => {
  const balanceAfter = await jettonWallet.getBalance();

  if (balanceChange < 0n) {
    expect(balanceAfter).toBe(balanceBefore - balanceChange);
  } else {
    expect(balanceAfter).toBeLessThan(balanceBefore);
  }
};

// Check Jetton Balance Not Changed
export const checkJettonBalNotChanged = async (jettonWallet: SandboxContract<JettonWallet>, balanceBefore: bigint) => {
  const balanceAfter = await jettonWallet.getBalance();
  expect(balanceAfter).toBe(balanceBefore);
};

// Check TON Balance Decrease only by gas fee
export const checkTONBalDecrease = async (
  blockchain: Blockchain,
  sender: Address,
  balanceBefore: bigint,
  gasFee: bigint = toNano('0.3'),
) => {
  const balanceAfter = await (await blockchain.getContract(sender)).balance;
  expect(balanceAfter + gasFee).toBeGreaterThanOrEqual(balanceBefore);
};
