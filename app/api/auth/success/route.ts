// app/api/auth/success/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { jsonError, handleAuthSuccess } from '../../../../lib/auth-service';
import { deterministicWalletFromUser } from '@/lib/wallet-utils';
import { createOrLoadSmartAccount } from '@/lib/biconomy-utils';
import { ethers } from 'ethers';
import { generatePasskeyPin } from '../../../../lib/auth-middleware';

interface AuthSuccessPayload {
  phoneNumber: string;
  token: string;
  credentialId: string;
  publicKey: string;
  userId: string;
}

const validatePayload = (
  data: Partial<AuthSuccessPayload>
): data is AuthSuccessPayload =>
  !!(
    data.phoneNumber &&
    data.token &&
    data.credentialId &&
    data.publicKey &&
    data.userId
  );

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as Partial<AuthSuccessPayload>;
    if (!validatePayload(data)) return jsonError('Missing required fields');

    const { phoneNumber, token, credentialId, publicKey, userId } = data;

    const passkeyPin = generatePasskeyPin(credentialId, publicKey);

    // Wallet setup
    const provider = new ethers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com'
    );
    const wallet = deterministicWalletFromUser(
      phoneNumber,
      passkeyPin,
      provider
    );
    const smartAccount = await createOrLoadSmartAccount(wallet);
    const address = await smartAccount.getAccountAddress();
    const balance = ethers.formatEther(await provider.getBalance(address));

    // Persist token + user data in Redis
    await handleAuthSuccess(
      phoneNumber,
      token,
      credentialId,
      publicKey,
      userId
    );

    return NextResponse.json({
      success: true,
      message:
        `🎉 **Welcome to Your Crypto Wallet!**\n\n` +
        `🏦 **Smart Wallet Created Successfully**\n` +
        `📍 Address: ${address}\n` +
        `💎 Balance: ${balance} ETH\n` +
        `✨ **Ready to Use!**\n` +
        `Go back to WhatsApp and try these commands:\n` +
        `• "get my balance"\n` +
        `• "get wallet address"\n` +
        `• "wallet info"`,
      walletInfo: {
        address,
        balance,
        passkeyPin: passkeyPin.substring(0, 4) + '****',
        network: 'Base Sepolia',
        credentialId: credentialId.substring(0, 8) + '...',
        securityLevel: 'Biometric Passkey Protected',
      },
    });
  } catch (err: unknown) {
    console.error('Auth success error:', err);
    return jsonError(
      (err as Error).message || 'Failed to complete wallet setup',
      400
    );
  }
}
