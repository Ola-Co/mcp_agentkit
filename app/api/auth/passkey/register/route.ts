// app/api/auth/passkey/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  getRegistrationOptions,
  verifyAndStoreRegistration,
  jsonError,
} from '../../../../../lib/auth-service';

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber } = await req.json();
    if (!phoneNumber) return jsonError('Phone number required');

    const options = await getRegistrationOptions(phoneNumber);
    return NextResponse.json(options);
  } catch (err: unknown) {
    console.error('Registration options error:', err);
    return jsonError(
      (err as Error).message || 'Failed to generate registration options',
      400
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { phoneNumber, credential } = await req.json();
    if (!phoneNumber || !credential)
      return jsonError('Phone number and credential required');

    const verified = await verifyAndStoreRegistration(phoneNumber, credential);
    return verified
      ? NextResponse.json({ verified: true })
      : jsonError('Verification failed');
  } catch (err: unknown) {
    console.error('Registration verification error:', err);
    return jsonError((err as Error).message || 'Verification failed', 400);
  }
}
