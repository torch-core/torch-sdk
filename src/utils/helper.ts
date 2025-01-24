import { getSecureRandomBytes } from '@ton/crypto';
import Decimal from 'decimal.js';

/**
 * Asynchronously generates a unique query identifier.
 * This function generates a secure random 64-byte buffer and reads the first
 * 8 bytes as a big-endian unsigned integer to produce a unique query ID.
 * This ID can be used to uniquely identify transactions or requests.
 *
 * WARNING: Highload wallet requires a different implementation of query ID generation.
 * @returns A unique query identifier in 64bit bigint.
 */
export async function generateQueryId(): Promise<bigint> {
  const buffer = await getSecureRandomBytes(64);
  return buffer.readBigUInt64BE(0);
}

export const toUnit = (amount: string | number, decimals: number = 9) => {
  return BigInt(new Decimal(amount.toString()).mul(new Decimal(10).pow(decimals)).toFixed(0));
};
