// lib/transaction-utils.ts
import { ethers, parseEther, isAddress } from 'ethers';
import { getAuthenticatedWallet } from './wallet-utils';

export interface TransferParams {
  to: string;
  amount: string;
  phoneNumber: string;
}

export interface TransferResult {
  success: boolean;
  message: string;
  txHash?: string;
  gasUsed?: string;
  error?: string;
}

/**
 * Parse and validate transfer command
 * Supports formats like:
 * - "send 0.1 eth to 0x1234..."
 * - "transfer 0.5 ETH 0x5678..."
 * - "send eth 0.2 to 0xabcd..."
 */
export function parseTransferCommand(message: string): TransferParams | null {
  // const text = message.toLowerCase().trim();

  // Regex patterns to match different command formats
  const patterns = [
    // "send 0.1 eth to 0x1234..."
    /send\s+([\d.]+)\s+eth\s+to\s+(0x[a-f0-9]{40})/i,
    // "transfer 0.5 ETH 0x5678..."
    /transfer\s+([\d.]+)\s+eth\s+(0x[a-f0-9]{40})/i,
    // "send eth 0.2 to 0xabcd..."
    /send\s+eth\s+([\d.]+)\s+to\s+(0x[a-f0-9]{40})/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const [, amount, to] = match;
      return {
        amount: amount.trim(),
        to: to.trim(),
        phoneNumber: '', // Will be set by caller
      };
    }
  }

  return null;
}

/**
 * Validate transfer parameters
 */
export function validateTransferParams(params: TransferParams): string | null {
  // Validate recipient address
  if (!isAddress(params.to)) {
    return '❌ Invalid recipient address. Please provide a valid Ethereum address.';
  }

  // Validate amount
  const amount = parseFloat(params.amount);
  if (isNaN(amount) || amount <= 0) {
    return '❌ Invalid amount. Please provide a positive number.';
  }

  if (amount > 10) {
    return '❌ Amount too large. Maximum transfer is 10 ETH for security.';
  }

  return null;
}

/**
 * Execute ETH transfer using Biconomy smart account
 */
export async function executeTransfer(
  params: TransferParams
): Promise<TransferResult> {
  try {
    const { smartAccount, wallet, address } = await getAuthenticatedWallet(
      params.phoneNumber
    );

    if (!wallet.provider) {
      return {
        success: false,
        message: '❌ Provider not available',
        error: 'No provider',
      };
    }

    // Check balance
    const balance = await wallet.provider.getBalance(address);
    const transferAmount = parseEther(params.amount);
    // Create transaction
    const transaction = {
      to: params.to,
      value: transferAmount,
      data: '0x', // Empty data for simple ETH transfer
    };
    const userOp = await smartAccount.buildUserOp([transaction]);
    const gasEstimates = await smartAccount.estimateUserOpGas(userOp);
    const totalGasCost =
      BigInt(gasEstimates.callGasLimit ?? 0) +
      BigInt(gasEstimates.verificationGasLimit ?? 0) +
      BigInt(gasEstimates.preVerificationGas ?? 0);

    const gasCostWei = totalGasCost * BigInt(gasEstimates.maxFeePerGas ?? 0);

    if (balance < transferAmount + gasCostWei) {
      const balanceEth = ethers.formatEther(balance);
      return {
        success: false,
        message: `❌ Insufficient balance. You have ${balanceEth} ETH, trying to send ${params.amount} ETH`,
        error: 'Insufficient balance',
      };
    }

    console.log('Executing transaction:', {
      from: address,
      to: params.to,
      value: params.amount,
    });

    // Execute transaction using Biconomy smart account
    const userOpResponse = await smartAccount.sendTransaction(transaction);

    const { transactionHash } = await userOpResponse.waitForTxHash();
    console.log('Transaction hash:', transactionHash);

    // Wait for transaction receipt
    const receipt = await userOpResponse.wait();

    return {
      success: true,
      message: `✅ Transfer successful!\n\n💸 Sent: ${params.amount} ETH\n📍 To: ${params.to}\n🔗 Transaction: ${transactionHash}`,
      txHash: transactionHash,
      gasUsed: receipt?.actualGasUsed?.toString(),
    };
  } catch (error) {
    console.error('Transfer error:', error);

    // Parse common error types
    let errorMessage = '❌ Transfer failed. Please try again.';
    const errorStr = error instanceof Error ? error.message : String(error);

    if (errorStr.includes('insufficient funds')) {
      errorMessage = '❌ Insufficient funds for transaction and gas fees.';
    } else if (errorStr.includes('nonce')) {
      errorMessage = '❌ Transaction nonce error. Please wait and try again.';
    } else if (errorStr.includes('gas')) {
      errorMessage = '❌ Gas estimation failed. Network might be congested.';
    }

    return {
      success: false,
      message: errorMessage,
      error: errorStr,
    };
  }
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(
  txHash: string,
  phoneNumber: string
): Promise<string> {
  try {
    const { wallet } = await getAuthenticatedWallet(phoneNumber);

    if (!wallet.provider) {
      return '❌ Provider not available';
    }

    const receipt = await wallet.provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return '⏳ Transaction pending...';
    }

    const status = receipt.status === 1 ? '✅ Confirmed' : '❌ Failed';
    const gasUsed = receipt.gasUsed.toString();
    const blockNumber = receipt.blockNumber;

    return `🔗 Transaction Status: ${status}\n📦 Block: ${blockNumber}\n⛽ Gas Used: ${gasUsed}`;
  } catch (error) {
    console.error('Error getting transaction status:', error);
    return '❌ Error checking transaction status.';
  }
}
