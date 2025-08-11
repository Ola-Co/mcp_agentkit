// app/api/auth/passkey/authenticate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticationOptions,
  verifyAuthentication,
  jsonError,
} from '../../../../../lib/auth-service';

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber } = await req.json();
    if (!phoneNumber) return jsonError('Phone number required');

    const options = await getAuthenticationOptions(phoneNumber);
    return NextResponse.json(options);
  } catch (err: unknown) {
    console.error('Auth options error:', err);
    return jsonError(
      (err as Error).message || 'Failed to generate authentication options',
      400
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { phoneNumber, credential } = await req.json();
    if (!phoneNumber || !credential)
      return jsonError('Phone number and credential required');

    const result = await verifyAuthentication(phoneNumber, credential);
    if (!result.verified) return jsonError('Authentication failed');

    return NextResponse.json({
      ...result,
      passkeyPin: result.passkeyPin
        ? result.passkeyPin.substring(0, 4) + '****'
        : undefined,
      message: 'Authentication successful! You can now use wallet commands.',
    });
  } catch (err: unknown) {
    console.error('Auth verification error:', err);
    return jsonError((err as Error).message || 'Authentication failed', 400);
  }
}
