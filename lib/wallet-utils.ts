// lib/wallet-utils.ts
import { Wallet, Provider } from 'ethers';
import { keccak256, toUtf8Bytes } from 'ethers';

const SERVER_SALT =
  process.env.WALLET_DERIVATION_SALT || 'your-service-unique-salt';

export function deterministicWalletFromUser(
  phoneNumber: string,
  userPin: string,
  provider: Provider
): Wallet {
  const secret = `${SERVER_SALT}|${phoneNumber}|${userPin}`;
  const hash = keccak256(toUtf8Bytes(secret));
  return new Wallet(hash, provider);
}
