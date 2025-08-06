// app/api/wallet/prepare-transaction/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '../../../../lib/auth-middleware';
import { getUserWallet } from '../../../../lib/wallet-storage';
import { smartWalletService } from '../../../../lib/smart-wallet-service';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const user = verifyAuthToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { to, amount, tokenType = 'ETH' } = await req.json();

    if (!to || !amount) {
      return NextResponse.json(
        { error: 'Recipient address and amount required' },
        { status: 400 }
      );
    }

    const walletData = await getUserWallet(user.userId);
    if (!walletData) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const txData = await smartWalletService.prepareTransaction(
      walletData.address,
      to,
      amount
    );

    return NextResponse.json({
      transaction: txData,
      requiresSignature: true,
      message: `Send ${amount} ${tokenType} to ${to}?`,
    });
  } catch (error) {
    console.error('Transaction preparation error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare transaction' },
      { status: 500 }
    );
  }
}
