// lib/wallet-storage.ts
import redis from './redis';

export interface SmartWalletData {
  address: string;
  type: 'coinbase-smart-wallet';
  chainId: number;
  createdAt: string;
  metadata?: {
    passkeyCredentialId?: string;
    lastUsed?: string;
    transactionCount?: number;
  };
}

const WALLET_TTL = 90 * 24 * 60 * 60; // 90 days

export async function storeUserWallet(
  userId: string,
  walletData: SmartWalletData
): Promise<void> {
  try {
    const key = `wallet:${userId}`;
    await redis.setex(key, WALLET_TTL, JSON.stringify(walletData));
    console.log(`Stored wallet for user: ${userId}`);
  } catch (error) {
    console.error('Error storing wallet:', error);
    throw error;
  }
}

export async function getUserWallet(
  userId: string
): Promise<SmartWalletData | null> {
  try {
    const key = `wallet:${userId}`;
    const walletData = await redis.get(key);
    return walletData ? JSON.parse(walletData) : null;
  } catch (error) {
    console.error('Error retrieving wallet:', error);
    return null;
  }
}

export async function updateWalletMetadata(
  userId: string,
  metadata: Partial<SmartWalletData['metadata']>
): Promise<void> {
  try {
    const existingWallet = await getUserWallet(userId);
    if (existingWallet) {
      existingWallet.metadata = { ...existingWallet.metadata, ...metadata };
      await storeUserWallet(userId, existingWallet);
    }
  } catch (error) {
    console.error('Error updating wallet metadata:', error);
    throw error;
  }
}
