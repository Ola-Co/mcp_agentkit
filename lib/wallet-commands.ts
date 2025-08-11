// lib/wallet-commands.ts (Enhanced with passkey PIN)
import { formatEther } from 'ethers';
import { getAuthenticatedWallet } from './wallet-utils';

export const WALLET_COMMANDS = [
  'connect wallet',
  'get balance',
  'get my balance',
  'check balance',
  'send tokens',
  'send eth',
  'send usdc',
  'swap tokens',
  'get wallet address',
  'wallet info',
  'transfer',
  'buy',
  'sell',
  'stake',
  'unstake',
];

export function isWalletCommand(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  return WALLET_COMMANDS.some(
    command =>
      lowerMessage.includes(command.toLowerCase()) ||
      lowerMessage.startsWith(command.toLowerCase())
  );
}

export function generateAuthLink(phoneNumber: string, baseUrl: string): string {
  const encodedPhone = encodeURIComponent(phoneNumber);
  return `${baseUrl}/auth?phone=${encodedPhone}`;
}

export type CommandHandler = (params: {
  phoneNumber: string;
  message: string;
}) => Promise<string>;

export const commandHandlers: Record<string, CommandHandler> = {
  register: async ({ phoneNumber }) => {
    return `Registration successful for ${phoneNumber}`;
  },
  'get balance': async ({ phoneNumber }) => {
    return await handleGetBalance(phoneNumber);
  },
  'get my balance': async ({ phoneNumber }) => {
    return await handleGetBalance(phoneNumber);
  },
  'check balance': async ({ phoneNumber }) => {
    return await handleGetBalance(phoneNumber);
  },
  'get wallet address': async ({ phoneNumber }) => {
    return await handleGetWalletAddress(phoneNumber);
  },
  'wallet info': async ({ phoneNumber }) => {
    return await handleGetWalletInfo(phoneNumber);
  },
  // Add more command handlers as needed
};

async function handleGetBalance(phoneNumber: string): Promise<string> {
  try {
    const { address, wallet } = await getAuthenticatedWallet(phoneNumber);
    if (!wallet || !wallet.provider) {
      return '❌ User not authenticated. Please authenticate first.';
    }
    const balance = await wallet.provider.getBalance(address);
    return `💰 Balance for ${address}:\n${formatEther(balance)} ETH`;
  } catch (err: unknown) {
    return (err as Error).message || '❌ Error retrieving balance.';
  }
}

async function handleGetWalletAddress(phoneNumber: string): Promise<string> {
  try {
    const { address, wallet } = await getAuthenticatedWallet(phoneNumber);
    if (!wallet || !wallet.provider) {
      return '❌ User not authenticated. Please authenticate first.';
    }

    return (
      `📍 **Your Smart Wallet Address**\n\n` +
      `${address}\n\n` +
      `🔐 Generated from your unique passkey`
    );
  } catch (error) {
    console.error('Error getting wallet address:', error);
    return '❌ Error retrieving wallet address. Please try again.';
  }
}

async function handleGetWalletInfo(phoneNumber: string): Promise<string> {
  try {
    const { userData, address, wallet } = await getAuthenticatedWallet(
      phoneNumber
    );
    if (!wallet || !wallet.provider) {
      return '❌ User not authenticated. Please authenticate first.';
    }
    const balance = await wallet.provider.getBalance(address);
    const balanceEth = formatEther(balance);

    return (
      `🏦 **Your Smart Wallet Info**\n\n` +
      `📍 Address: ${address}\n` +
      `💎 Balance: ${balanceEth} ETH\n` +
      `🔐 PIN Source: Passkey (${userData.passkeyPin})\n` +
      `🆔 Credential: ${userData.credentialId.substring(0, 8)}...\n\n` +
      `✨ Your wallet is secured by biometric authentication`
    );
  } catch (error) {
    console.error('Error getting wallet info:', error);
    return '❌ Error retrieving wallet information. Please try again.';
  }
}
