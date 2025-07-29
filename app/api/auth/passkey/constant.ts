// app/api/auth/passkey/constant.ts
import type { AuthenticatorTransportFuture } from '@simplewebauthn/typescript-types';

export const RP_ID = process.env.RP_ID || 'localhost';
export const RP_NAME = process.env.RP_NAME || 'WhatsApp Crypto Bot';
export const ORIGIN = process.env.ORIGIN || 'http://localhost:3579';

// Proper type for stored credentials
export interface StoredCredential {
  id: Uint8Array;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

// In-memory storage for demo (use Redis/database in production)
export const challengeStore = new Map<string, string>();
export const userCredentials = new Map<string, StoredCredential[]>();
