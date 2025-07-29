// app/api/auth/passkey/authenticate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { userCredentials, challengeStore } from '../constant';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || 'http://localhost:3579';

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
    const credentials = userCredentials.get(userId);

    if (!credentials || credentials.length === 0) {
      return NextResponse.json(
        { error: 'No credentials found. Please register first.' },
        { status: 404 }
      );
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: credentials.map(cred => ({
        id: isoBase64URL.fromBuffer(cred.id),
        type: 'public-key',
        transports: cred.transports,
      })),
      userVerification: 'preferred',
    });

    challengeStore.set(userId, options.challenge);

    return NextResponse.json(options);
  } catch (error) {
    console.error('Authentication options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
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
    const credentials = userCredentials.get(userId);

    if (!expectedChallenge || !credentials) {
      return NextResponse.json(
        { error: 'Challenge or credentials not found' },
        { status: 400 }
      );
    }

    const credentialToVerify = credentials.find(
      cred => isoBase64URL.fromBuffer(cred.id) === credential.id
    );

    if (!credentialToVerify) {
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 400 }
      );
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: isoBase64URL.fromBuffer(credentialToVerify.id),
        publicKey: credentialToVerify.publicKey,
        counter: credentialToVerify.counter,
        transports: credentialToVerify.transports,
      },
      requireUserVerification: false,
    });

    if (verification.verified) {
      // Update counter
      credentialToVerify.counter = verification.authenticationInfo.newCounter;

      // Generate JWT token
      const token = jwt.sign(
        { userId, phoneNumber },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      challengeStore.delete(userId);

      return NextResponse.json({
        verified: true,
        token,
        message: 'Authentication successful! You can now use wallet commands.',
      });
    }

    return NextResponse.json(
      { verified: false, error: 'Authentication failed' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Authentication verification error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
