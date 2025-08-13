// lib/wallet-commands.ts
import { formatEther } from 'ethers';
import { getAuthenticatedWallet } from './wallet-utils';
import {
  parseTransferCommand,
  validateTransferParams,
  executeTransfer,
  getTransactionStatus,
} from './transaction-utils';

export const WALLET_COMMANDS = [
  'connect wallet',
  'get balance',
  'get my balance',
  'check balance',
  'send eth',
  'transfer eth',
  'send tokens',
  'send usdc',
  'swap tokens',
  'get wallet address',
  'wallet info',
  'transfer',
  'buy',
  'sell',
  'stake',
  'unstake',
  'tx status', // New command for checking transaction status
];

export function isWalletCommand(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  return (
    WALLET_COMMANDS.some(
      command =>
        lowerMessage.includes(command.toLowerCase()) ||
        lowerMessage.startsWith(command.toLowerCase())
    ) ||
    isTransferCommand(message) ||
    isStatusCommand(message)
  );
}

export function isTransferCommand(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  return (
    /^(send|transfer).*(eth|ethereum).*to\s+0x[a-f0-9]{40}/i.test(
      lowerMessage
    ) || /^(send|transfer)\s+[\d.]+\s+(eth|ethereum)/i.test(lowerMessage)
  );
}

export function isStatusCommand(message: string): boolean {
  return /^(tx|transaction)\s+status\s+0x[a-f0-9]{64}/i.test(
    message.toLowerCase().trim()
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
  'send eth': async ({ phoneNumber, message }) => {
    return await handleTransfer(phoneNumber, message);
  },
  'transfer eth': async ({ phoneNumber, message }) => {
    return await handleTransfer(phoneNumber, message);
  },
  transfer: async ({ phoneNumber, message }) => {
    // Check if it's an ETH transfer
    if (message.toLowerCase().includes('eth')) {
      return await handleTransfer(phoneNumber, message);
    }
    return '❌ Please specify the token to transfer (e.g., "transfer 0.1 eth to 0x...")';
  },
  'tx status': async ({ phoneNumber, message }) => {
    return await handleTransactionStatus(phoneNumber, message);
  },
};

// Enhanced command handlers
async function handleGetBalance(phoneNumber: string): Promise<string> {
  try {
    const { address, wallet } = await getAuthenticatedWallet(phoneNumber);
    if (!wallet || !wallet.provider) {
      return '❌ User not authenticated. Please authenticate first.';
    }
    const balance = await wallet.provider.getBalance(address);
    return `💰 Balance for ${address.substring(0, 10)}...${address.substring(
      38
    )}:\n${formatEther(balance)} ETH`;
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
      `🔐 Generated from your unique passkey\n` +
      `💡 You can receive ETH and tokens at this address`
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
      `📍 Address: ${address.substring(0, 10)}...${address.substring(38)}\n` +
      `💎 Balance: ${balanceEth} ETH\n` +
      `🔐 PIN Source: Passkey (${userData.passkeyPin.substring(0, 4)}****)\n` +
      `🆔 Credential: ${userData.credentialId.substring(0, 8)}...\n\n` +
      `✨ Your wallet is secured by biometric authentication\n` +
      `💸 Send ETH: "send 0.1 eth to 0x..."`
    );
  } catch (error) {
    console.error('Error getting wallet info:', error);
    return '❌ Error retrieving wallet information. Please try again.';
  }
}

async function handleTransfer(
  phoneNumber: string,
  message: string
): Promise<string> {
  try {
    // Parse the transfer command
    const transferParams = parseTransferCommand(message);
    if (!transferParams) {
      return (
        '❌ Invalid transfer format. Use:\n\n' +
        '• "send 0.1 eth to 0x1234..."\n' +
        '• "transfer 0.5 eth 0x5678..."\n\n' +
        '💡 Make sure to include a valid Ethereum address (0x...)'
      );
    }

    transferParams.phoneNumber = phoneNumber;

    // Validate parameters
    const validationError = validateTransferParams(transferParams);
    if (validationError) {
      return validationError;
    }

    // // Show confirmation message first
    // const confirmationMsg =
    //   `🔄 Processing transfer...\n\n` +
    //   `💸 Amount: ${transferParams.amount} ETH\n` +
    //   `📍 To: ${transferParams.to.substring(
    //     0,
    //     10
    //   )}...${transferParams.to.substring(38)}\n\n` +
    //   `⏳ Please wait while we execute the transaction...`;

    // Execute the transfer
    const result = await executeTransfer(transferParams);

    return result.message;
  } catch (error) {
    console.error('Error handling transfer:', error);
    return '❌ Error processing transfer. Please try again.';
  }
}

async function handleTransactionStatus(
  phoneNumber: string,
  message: string
): Promise<string> {
  try {
    // Extract transaction hash from message
    const match = message.match(/0x[a-f0-9]{64}/i);
    if (!match) {
      return '❌ Please provide a valid transaction hash (0x...)';
    }

    const txHash = match[0];
    return await getTransactionStatus(txHash, phoneNumber);
  } catch (error) {
    console.error('Error checking transaction status:', error);
    return '❌ Error checking transaction status. Please try again.';
  }
}
