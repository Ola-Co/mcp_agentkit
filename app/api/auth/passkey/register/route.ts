// app/api/auth/passkey/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import crypto from 'crypto';
import {
  userCredentials,
  challengeStore,
  RP_ID,
  ORIGIN,
  RP_NAME,
} from '../constant';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
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

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      //   userID: userId,
      userName: phoneNumber,
      userDisplayName: `User ${phoneNumber}`,
      attestationType: 'none',
      excludeCredentials:
        userCredentials.get(userId)?.map(cred => ({
          id: isoBase64URL.fromBuffer(cred.id),
          //   type: 'public-key',
          //   transports: cred.transports,
        })) || [],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    // Store challenge temporarily
    challengeStore.set(userId, options.challenge);

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
    const expectedChallenge = challengeStore.get(userId);

    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 400 }
      );
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false, // Add this line
    });

    if (verification.verified && verification.registrationInfo) {
      // Store credential - use correct property names
      const { credential } = verification.registrationInfo;

      const existingCredentials = userCredentials.get(userId) || [];
      const newCredential = {
        id: isoBase64URL.toBuffer(credential.id), // Changed from credentialID
        publicKey: credential.publicKey, // Changed from credentialPublicKey
        counter: credential.counter,
        transports: credential.transports || [],
      };

      userCredentials.set(userId, [...existingCredentials, newCredential]);
      challengeStore.delete(userId);

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
