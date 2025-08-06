// lib/whatsapp-handler.ts (New file)
import { getUserToken, verifyAuthToken } from './auth-middleware';
import { getUserWallet } from './wallet-storage';
import { smartWalletService } from './smart-wallet-service';
import { parseWalletCommand, generateAuthLink } from './wallet-commands';

export async function handleWalletCommand(
  phoneNumber: string,
  message: string,
  baseUrl: string
) {
  try {
    // Check if user is authenticated
    const token = await getUserToken(phoneNumber);
    if (!token) {
      const authLink = generateAuthLink(phoneNumber, baseUrl);
      return `🔐 Please authenticate first to use wallet features:\n${authLink}`;
    }

    const user = verifyAuthToken(token);
    if (!user) {
      const authLink = generateAuthLink(phoneNumber, baseUrl);
      return `🔐 Session expired. Please authenticate again:\n${authLink}`;
    }

    const walletData = await getUserWallet(user.userId);
    if (!walletData) {
      return `❌ Wallet not found. Please re-authenticate to create your smart wallet.`;
    }

    // Parse the command
    const command = parseWalletCommand(message);

    switch (command.type) {
      case 'balance':
        const ethBalance = await smartWalletService.getBalance(
          walletData.address
        );
        const usdcBalance = await smartWalletService.getTokenBalance(
          walletData.address,
          'USDC'
        );
        const usdtBalance = await smartWalletService.getTokenBalance(
          walletData.address,
          'USDT'
        );

        return (
          `💰 *Your Wallet Balance*\n\n` +
          `🔷 ETH: ${ethBalance}\n` +
          `💵 USDC: ${usdcBalance}\n` +
          `💴 USDT: ${usdtBalance}\n\n` +
          `📍 Address: \`${walletData.address}\``
        );

      case 'address':
        return (
          `📍 *Your Smart Wallet Address*\n\n\`${walletData.address}\`\n\n` +
          `Network: Base (Chain ID: ${walletData.chainId})`
        );

      case 'info':
        return (
          `ℹ️ *Wallet Information*\n\n` +
          `📍 Address: \`${walletData.address}\`\n` +
          `🔗 Type: ${walletData.type}\n` +
          `🌐 Network: Base\n` +
          `📅 Created: ${new Date(
            walletData.createdAt
          ).toLocaleDateString()}\n` +
          `🔄 Last Used: ${
            walletData.metadata?.lastUsed
              ? new Date(walletData.metadata.lastUsed).toLocaleDateString()
              : 'N/A'
          }`
        );

      case 'send':
        if (!command.amount || !command.token || !command.recipient) {
          return `❌ Invalid send command. Use format: "send 0.1 ETH to 0x..."`;
        }

        return (
          `🚀 *Transaction Prepared*\n\n` +
          `Send: ${command.amount} ${command.token}\n` +
          `To: \`${command.recipient}\`\n\n` +
          `⚠️ *Transaction execution coming soon!*\n` +
          `Currently in development phase.`
        );

      case 'swap':
        if (!command.amount || !command.fromToken || !command.toToken) {
          return `❌ Invalid swap command. Use format: "swap 100 USDC for ETH"`;
        }

        return (
          `🔄 *Swap Prepared*\n\n` +
          `From: ${command.amount} ${command.fromToken}\n` +
          `To: ${command.toToken}\n\n` +
          `⚠️ *Swap execution coming soon!*\n` +
          `Currently in development phase.`
        );

      default:
        return (
          `❓ Command not recognized. Available commands:\n\n` +
          `• "get my balance" - Check balances\n` +
          `• "get wallet address" - Show address\n` +
          `• "wallet info" - Wallet details\n` +
          `• "send 0.1 ETH to 0x..." - Send tokens\n` +
          `• "swap 100 USDC for ETH" - Swap tokens`
        );
    }
  } catch (error) {
    console.error('Wallet command error:', error);
    return `❌ An error occurred processing your wallet command. Please try again.`;
  }
}
