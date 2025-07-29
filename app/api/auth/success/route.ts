// API route to handle authentication success callback
// app/api/auth/success/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { storeUserToken } from '../../../../lib/auth-middleware';

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, token } = await req.json();

    if (!phoneNumber || !token) {
      return NextResponse.json(
        { error: 'Phone number and token required' },
        { status: 400 }
      );
    }

    // Store the token for the user
    storeUserToken(phoneNumber, token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing auth token:', error);
    return NextResponse.json(
      { error: 'Failed to store authentication' },
      { status: 500 }
    );
  }
}
