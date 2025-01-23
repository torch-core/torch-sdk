import Decimal from 'decimal.js';

export const generateQueryId = async () => {
  return 100n;
};

export const toUnit = (amount: string, decimals: number) => {
  return BigInt(new Decimal(amount).mul(new Decimal(10).pow(decimals)).toFixed(0));
};
