// app/api/whatsapp/route.ts (Updated with Redis auth)
import { NextRequest, NextResponse } from 'next/server';

import {
  processIncomingWhatsAppMessage,
  sendWhatsAppMessage,
} from '@/lib/whatsapp-processor';

export async function GET(req: NextRequest) {
  console.log('GET API called for WhatsApp verification');
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const challenge = searchParams.get('hub.challenge');
    const token = searchParams.get('hub.verify_token');
    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
  } catch (error) {
    console.error('Error in POST handler:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const msgObj = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!msgObj) return new NextResponse('OK', { status: 200 });

    const from = msgObj.from;
    const message = msgObj?.text?.body || '';

    const reply = await processIncomingWhatsAppMessage(from, message);
    await sendWhatsAppMessage(from, reply);

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Error in POST handler:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
