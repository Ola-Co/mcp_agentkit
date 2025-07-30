// app/api/auth/passkey/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import crypto from 'crypto';
import { RP_ID, ORIGIN, RP_NAME } from '../constant';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import {
  storeChallenge,
  getChallenge,
  removeChallenge,
  getUserCredentials,
  addUserCredential,
} from '../../../../../lib/passkey-storage';
export async function POST(req: NextRequest) {
  try {
    const { phoneNumber } = await req.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number required' },
        { status: 400 }
      );
    }

    const userId = crypto
      .createHash('sha256')
      .update(phoneNumber)
      .digest('hex');

    // Get existing credentials from Redis
    const existingCredentials = await getUserCredentials(userId);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: phoneNumber,
      userDisplayName: `User ${phoneNumber}`,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map(cred => ({
        id: isoBase64URL.fromBuffer(cred.id),
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    // Store challenge in Redis with TTL
    await storeChallenge(userId, options.challenge);

    return NextResponse.json(options);
  } catch (error) {
    console.error('Registration options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { phoneNumber, credential } = await req.json();

    if (!phoneNumber || !credential) {
      return NextResponse.json(
        { error: 'Phone number and credential required' },
        { status: 400 }
      );
    }

    const userId = crypto
      .createHash('sha256')
      .update(phoneNumber)
      .digest('hex');

    // Get challenge from Redis
    const expectedChallenge = await getChallenge(userId);

    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'Challenge not found or expired' },
        { status: 400 }
      );
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential: verifiedCredential } = verification.registrationInfo;

      const newCredential = {
        id: isoBase64URL.toBuffer(verifiedCredential.id),
        publicKey: verifiedCredential.publicKey,
        counter: verifiedCredential.counter,
        transports: verifiedCredential.transports || [],
      };

      // Add credential to Redis
      await addUserCredential(userId, newCredential);

      // Remove challenge from Redis
      await removeChallenge(userId);

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json(
      { verified: false, error: 'Verification failed' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Registration verification error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
