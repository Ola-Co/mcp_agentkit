// lib/wallet-utils.ts
import { Wallet, Provider } from 'ethers';
import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'ethers';
import { getUserData, StoredUserData } from './auth-middleware';
import { createOrLoadSmartAccount } from './biconomy-utils';

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

export interface AuthenticatedWallet {
  userData: StoredUserData;
  wallet: ethers.Wallet;
  smartAccount: Awaited<ReturnType<typeof createOrLoadSmartAccount>>;
  address: string;
}

/**
 * Verifies auth and returns a ready wallet + smart account.
 */
export async function getAuthenticatedWallet(
  phoneNumber: string
): Promise<AuthenticatedWallet> {
  const userData = await getUserData(phoneNumber);
  if (!userData) {
    throw new Error('❌ User not authenticated. Please authenticate first.');
  }

  const provider = new ethers.JsonRpcProvider(
    process.env.SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com'
  );

  // Build wallet using passkey-derived PIN
  const wallet = deterministicWalletFromUser(
    phoneNumber,
    userData.passkeyPin,
    provider
  );

  const smartAccount = await createOrLoadSmartAccount(wallet);
  const address = await smartAccount.getAccountAddress();

  return { userData, wallet, smartAccount, address };
}
