// app/api/wallet/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '../../../../lib/auth-middleware';
import { getUserWallet } from '../../../../lib/wallet-storage';
import { smartWalletService } from '../../../../lib/smart-wallet-service';

export async function GET(req: NextRequest) {
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

    const walletData = await getUserWallet(user.userId);
    if (!walletData) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Get ETH balance
    const ethBalance = await smartWalletService.getBalance(walletData.address);

    // Get token balances (USDC, USDT)
    const usdcBalance = await smartWalletService.getTokenBalance(
      walletData.address,
      'USDC_CONTRACT_ADDRESS'
    );
    const usdtBalance = await smartWalletService.getTokenBalance(
      walletData.address,
      'USDT_CONTRACT_ADDRESS'
    );

    return NextResponse.json({
      address: walletData.address,
      balances: {
        ETH: ethBalance,
        USDC: usdcBalance,
        USDT: usdtBalance,
      },
      chainId: walletData.chainId,
    });
  } catch (error) {
    console.error('Balance fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
