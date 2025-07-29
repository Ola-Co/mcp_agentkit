// app/api/whatsapp/route.ts (Updated version)
import { NextRequest, NextResponse } from 'next/server';
import { createAgent } from '../agent/create-agent';
import {
  verifyAuthToken,
  getUserToken,
  AuthenticatedUser,
  removeUserToken,
} from '../../../lib/auth-middleware';
import {
  isWalletCommand,
  generateAuthLink,
} from '../../../lib/wallet-commands';

const WHATSAPP_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3579';

export async function GET(req: NextRequest) {
  console.log('GET API called for WhatsApp verification');
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');
  const token = searchParams.get('hub.verify_token');
  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse(null, { status: 403 });
}

export async function POST(req: NextRequest) {
  console.log('POST API called for WhatsApp messages');

  try {
    const body = await req.json();
    console.log('Received body:', JSON.stringify(body, null, 2));

    // Extract message and sender info from WhatsApp webhook payload
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Check if this is a message webhook (not status update or other types)
    if (
      !value?.messages ||
      !Array.isArray(value.messages) ||
      value.messages.length === 0
    ) {
      console.log(
        'No messages found in webhook - might be status update or other webhook type'
      );
      return new NextResponse('OK', { status: 200 });
    }

    const messageObj = value.messages[0];
    const message = messageObj?.text?.body;
    const from = messageObj?.from;

    // Validate required fields
    if (!message || !from) {
      console.log('Missing message text or sender info:', { message, from });
      return new NextResponse('OK', { status: 200 });
    }

    console.log('Processing message:', message, 'from:', from);

    let reply = "Sorry, I didn't understand that.";
    let authenticatedUser: AuthenticatedUser | null = null;

    // Check if user is trying to authenticate
    if (
      message.toLowerCase().includes('/auth') ||
      message.toLowerCase().includes('authenticate')
    ) {
      const authLink = generateAuthLink(from, BASE_URL);
      reply = `🔐 Please authenticate to use wallet features:\n\n${authLink}\n\nTap the link above to securely connect using your device's biometric authentication or passkey.`;
      await sendWhatsAppMessage(from, reply);
      return new NextResponse('OK', { status: 200 });
    }

    // Check if user wants to logout
    if (
      message.toLowerCase().includes('/logout') ||
      message.toLowerCase().includes('logout')
    ) {
      removeUserToken(from);
      reply =
        '👋 You have been logged out successfully. Send "/auth" to authenticate again.';
      await sendWhatsAppMessage(from, reply);
      return new NextResponse('OK', { status: 200 });
    }

    // Check if this is a wallet-related command
    const requiresAuth = isWalletCommand(message);

    if (requiresAuth) {
      // Check if user is authenticated
      const userToken = getUserToken(from); //      ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlNWYzMmFlNDU2NzQ1MjRkNmQ4NzFlOThlMWI1MzJmMWE1ZDgwYThmMjAxOGUwZWQ2MmM3NzM4NmM0ZDJiNGUzIiwicGhvbmVOdW1iZXIiOiIxNDA4NDQyOTgxMiIsImlhdCI6MTc1MzgyNjI3NSwiZXhwIjoxNzUzOTEyNjc1fQ.eX1NygNfig98yjBrBKs4D7XGcfyw6-5SXLu07omoEdI');
      if (userToken) {
        authenticatedUser = verifyAuthToken(userToken);
      }

      if (!authenticatedUser) {
        const authLink = generateAuthLink(from, BASE_URL);
        reply = `🔐 Authentication required for wallet operations.\n\nPlease authenticate first:\n${authLink}\n\nOnce authenticated, you can use commands like:\n• "get my balance"\n• "send 0.1 ETH to 0x..."\n• "swap 100 USDC for ETH"`;
        await sendWhatsAppMessage(from, reply);
        return new NextResponse('OK', { status: 200 });
      }
    }

    try {
      // Get the agent instance
      const agent = await createAgent();

      // Create a unique thread ID for this conversation
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      let threadId = `whatsapp_user_${from}_${Math.floor(
        yesterday / (24 * 60 * 60 * 1000)
      )}`;

      // Check if user wants to reset conversation
      if (
        message.toLowerCase().includes('/reset') ||
        message.toLowerCase().includes('start over')
      ) {
        const timestamp = Date.now();
        threadId = `whatsapp_user_${from}_${timestamp}`;
      }

      console.log('Invoking agent with thread ID:', threadId);

      // Prepare the message with authentication context
      let contextualMessage = message;
      if (authenticatedUser) {
        contextualMessage = `[Authenticated user: ${authenticatedUser.phoneNumber}] ${message}`;
      }

      // Use the agent to process the message with proper configuration
      const agentResponse = await agent.invoke(
        {
          input: contextualMessage,
        },
        {
          configurable: {
            thread_id: threadId,
          },
        }
      );

      console.log('Raw agent response:', agentResponse);

      // Extract the response content
      if (agentResponse?.messages && Array.isArray(agentResponse.messages)) {
        // Get the last AIMessage
        const lastMessage =
          agentResponse.messages[agentResponse.messages.length - 1];
        if (lastMessage?.content) {
          reply = lastMessage.content;
        }
      } else if (agentResponse?.content) {
        reply = agentResponse.content;
      } else if (typeof agentResponse === 'string') {
        reply = agentResponse;
      }

      // Add authentication status to non-wallet commands if helpful
      if (!requiresAuth && !authenticatedUser) {
        reply +=
          '\n\n💡 *Tip: Send "/auth" to connect your wallet for crypto operations.*';
      }

      console.log('Processed reply:', reply);
    } catch (agentError) {
      console.error('Error processing message with agent:', agentError);
      reply =
        "I'm experiencing some technical difficulties. Please try again later.";
    }

    await sendWhatsAppMessage(from, reply);
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Error in POST handler:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

async function sendWhatsAppMessage(to: string, message: string) {
  try {
    if (WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      console.log('Sending WhatsApp reply to:', to);

      const whatsappResponse = await fetch(WHATSAPP_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      });

      if (!whatsappResponse.ok) {
        const errorBody = await whatsappResponse.text();
        console.error('WhatsApp API error:', {
          status: whatsappResponse.status,
          statusText: whatsappResponse.statusText,
          body: errorBody,
        });
      } else {
        console.log('Successfully sent WhatsApp message');
        const responseData = await whatsappResponse.json();
        console.log('WhatsApp API response:', responseData);
      }
    } else {
      console.error('WhatsApp API credentials are missing:', {
        hasToken: !!WHATSAPP_ACCESS_TOKEN,
        hasPhoneId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
      });
    }
  } catch (whatsappError) {
    console.error('Error sending WhatsApp message:', whatsappError);
  }
}
