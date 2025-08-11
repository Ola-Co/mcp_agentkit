// lib/auth-service.ts
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  generateRegistrationOptions,
  verifyRegistrationResponse,
  RegistrationResponseJSON,
  WebAuthnCredential,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

import {
  storeChallenge,
  getChallenge,
  removeChallenge,
  getUserCredentials,
  addUserCredential,
  updateCredentialCounter,
} from './passkey-storage';

import {
  generatePasskeyPin,
  createAuthToken,
  storeUserToken,
} from './auth-middleware';

import type { StoredCredential } from './passkey-storage';

// Centralized constants
export const RP_ID = process.env.RP_ID || 'localhost';
export const ORIGIN = process.env.ORIGIN || 'http://localhost:3579';
export const RP_NAME = process.env.RP_NAME || 'My WebAuthn App';

/**
 * ===== Helper Utilities =====
 */

// Return standardized JSON error
export const jsonError = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

// Create deterministic userId from phone
export const getUserIdFromPhone = (phoneNumber: string) =>
  crypto.createHash('sha256').update(phoneNumber).digest('hex');

/**
 * ===== Passkey Registration =====
 */
export async function getRegistrationOptions(phoneNumber: string) {
  const userId = getUserIdFromPhone(phoneNumber);
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

  await storeChallenge(userId, options.challenge);
  return options;
}

export async function verifyAndStoreRegistration(
  phoneNumber: string,
  credential: unknown
) {
  const userId = getUserIdFromPhone(phoneNumber);
  const expectedChallenge = await getChallenge(userId);
  if (!expectedChallenge) throw new Error('Challenge not found or expired');

  const verification = await verifyRegistrationResponse({
    response: credential as RegistrationResponseJSON,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false,
  });

  if (verification.verified && verification.registrationInfo) {
    const { credential: verifiedCredential } = verification.registrationInfo;
    const newCredential: StoredCredential = {
      id: isoBase64URL.toBuffer(verifiedCredential.id),
      publicKey: verifiedCredential.publicKey,
      counter: verifiedCredential.counter,
      transports: verifiedCredential.transports || [],
    };

    await addUserCredential(userId, newCredential);
    await removeChallenge(userId);

    return true;
  }
  return false;
}

/**
 * ===== Passkey Authentication =====
 */
export async function getAuthenticationOptions(phoneNumber: string) {
  const userId = getUserIdFromPhone(phoneNumber);
  const credentials = await getUserCredentials(userId);

  if (!credentials?.length) throw new Error('No credentials found');

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: credentials.map(cred => ({
      id: isoBase64URL.fromBuffer(cred.id),
      type: 'public-key',
      transports: cred.transports,
    })),
    userVerification: 'preferred',
  });

  await storeChallenge(userId, options.challenge);
  return options;
}

export async function verifyAuthentication(
  phoneNumber: string,
  credential: WebAuthnCredential
) {
  const userId = getUserIdFromPhone(phoneNumber);
  const expectedChallenge = await getChallenge(userId);
  if (!expectedChallenge) throw new Error('Challenge not found or expired');

  const credentials = await getUserCredentials(userId);
  const credentialToVerify = credentials.find(
    cred => isoBase64URL.fromBuffer(cred.id) === credential.id
  );
  if (!credentialToVerify) throw new Error('Credential not found');

  const verification = await verifyAuthenticationResponse({
    response: credential as unknown as AuthenticationResponseJSON,
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
    await updateCredentialCounter(
      userId,
      credentialToVerify.id,
      verification.authenticationInfo.newCounter
    );

    const credentialId = credential.id;
    const publicKeyHex = Buffer.from(credentialToVerify.publicKey).toString(
      'hex'
    );
    const passkeyPin = generatePasskeyPin(credentialId, publicKeyHex);
    const token = createAuthToken(
      userId,
      phoneNumber,
      credentialId,
      publicKeyHex,
      passkeyPin
    );

    await removeChallenge(userId);

    return {
      verified: true,
      token,
      userId,
      credentialId,
      publicKey: publicKeyHex,
      passkeyPin,
    };
  }

  return { verified: false };
}

/**
 * ===== Wallet Success Handling =====
 */
export async function handleAuthSuccess(
  phoneNumber: string,
  token: string,
  credentialId: string,
  publicKey: string,
  userId: string
) {
  // Store enhanced user data in Redis for later bot commands
  await storeUserToken(phoneNumber, token, credentialId, publicKey, userId);
}
