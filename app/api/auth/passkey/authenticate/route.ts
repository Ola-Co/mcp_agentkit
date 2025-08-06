// app/api/auth/passkey/authenticate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import {
  storeChallenge,
  getChallenge,
  removeChallenge,
  getUserCredentials,
  updateCredentialCounter,
} from '../../../../../lib/passkey-storage';
import {
  getUserWallet,
  storeUserWallet,
  updateWalletMetadata,
} from '@/lib/wallet-storage';
import { smartWalletService } from '@/lib/smart-wallet-service';

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

    // Get credentials from Redis
    const credentials = await getUserCredentials(userId);

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

    // Store challenge in Redis with TTL
    await storeChallenge(userId, options.challenge);

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

    // Get challenge from Redis
    const expectedChallenge = await getChallenge(userId);
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'Challenge not found or expired' },
        { status: 400 }
      );
    }

    // Get credentials from Redis
    const credentials = await getUserCredentials(userId);
    if (!credentials || credentials.length === 0) {
      return NextResponse.json(
        { error: 'Credentials not found' },
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
      // Update counter in Redis
      await updateCredentialCounter(
        userId,
        credentialToVerify.id,
        verification.authenticationInfo.newCounter
      );

      // Check if user has a wallet, create if not
      let walletData = await getUserWallet(userId);

      if (!walletData) {
        // Create new smart wallet for first-time user
        walletData = await smartWalletService.createSmartWallet(
          userId,
          credential.id
        );
        await storeUserWallet(userId, walletData);
      } else {
        // Update last used timestamp for existing wallet
        await updateWalletMetadata(userId, {
          lastUsed: new Date().toISOString(),
        });
      }

      // Generate JWT token with wallet info
      const token = jwt.sign(
        {
          userId,
          phoneNumber,
          walletAddress: walletData.address,
          hasWallet: true,
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Remove challenge from Redis
      await removeChallenge(userId);

      return NextResponse.json({
        verified: true,
        token,
        walletAddress: walletData.address,
        message: 'Authentication successful! Your smart wallet is ready.',
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
