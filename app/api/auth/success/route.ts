// API route to handle authentication success callback
// app/api/auth/success/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { storeUserToken } from '../../../../lib/auth-middleware';
import { deterministicWalletFromUser } from '@/lib/wallet-utils';
import { createOrLoadSmartAccount } from '@/lib/biconomy-utils';
import { ethers } from 'ethers';
export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, token } = await req.json();

    if (!phoneNumber || !token) {
      return NextResponse.json(
        { error: 'Phone number and token required' },
        { status: 400 }
      );
    }
    const userPin = phoneNumber.slice(-6); // Example: last 6 digits as PIN
    const provider = new ethers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com'
    );
    const wallet = deterministicWalletFromUser(phoneNumber, userPin, provider);

    // Create or load existing smart account for that wallet/signer
    const smartAccountClient = await createOrLoadSmartAccount(wallet);

    const address = await smartAccountClient.getAccountAddress();
    const balanceBigInt = await provider.getBalance(address);
    const balance = ethers.formatEther(balanceBigInt);

    console.log('Smart Account Address:', address);
    // Store the token in Redis
    await storeUserToken(phoneNumber, token);

    return NextResponse.json({
      success: true,
      message:
        'Authentication success stored. Smart account address: ' +
        address +
        '\nBalance: ' +
        balance +
        ' ETH',
    });
  } catch (error) {
    console.error('Error storing auth success:', error);
    return NextResponse.json(
      { error: 'Failed to store authentication success' },
      { status: 500 }
    );
  }
}
