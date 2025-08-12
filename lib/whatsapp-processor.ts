// lib/whatsapp-processor.ts

import {
  verifyAuthToken,
  getUserToken,
  refreshUserToken,
  removeUserToken,
} from '@/lib/auth-middleware';
import {
  WALLET_COMMANDS,
  isWalletCommand,
  generateAuthLink,
  commandHandlers,
} from '@/lib/wallet-commands';
const WHATSAPP_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

function parseCommand(message: string) {
  // Find matching command in WALLET_COMMANDS
  const text = message.trim().toLowerCase();
  return WALLET_COMMANDS.find((cmd: string) =>
    text.startsWith(cmd.toLowerCase())
  );
}
export async function handleWhatsAppMessage({
  from,
  message,
}: {
  from: string;
  message: string;
}) {
  const cmd = parseCommand(message);
  if (!cmd) return `Unknown command. Available: ${WALLET_COMMANDS.join(', ')}`;

  const handler = commandHandlers[cmd];
  if (!handler) return `Handler not implemented for "${cmd}"`;

  // Pass all context to handler
  return await handler({
    phoneNumber: from,
    message,
  });
}

export async function processIncomingWhatsAppMessage(
  from: string,
  message: string
) {
  let reply = "Sorry, I didn't understand that.";

  // Step 1: Handle explicit auth/logout
  if (/\/auth|authenticate/i.test(message)) {
    const authLink = generateAuthLink(
      from,
      process.env.BASE_URL || 'http://localhost:3579'
    );
    return `🔐 Please authenticate to use wallet features:\n\n${authLink}`;
  }
  if (/\/logout|logout/i.test(message)) {
    await removeUserToken(from);
    return '👋 Logged out successfully.';
  }

  // Step 2: If wallet command, check authentication
  if (isWalletCommand(message)) {
    const userToken = await getUserToken(from);
    if (!userToken) {
      const authLink = generateAuthLink(
        from,
        process.env.BASE_URL || 'http://localhost:3579'
      );
      return `🔐 Authentication required for wallet operations.\n\n${authLink}`;
    }
    // refresh TTL
    const authUser = verifyAuthToken(userToken);
    if (authUser) await refreshUserToken(from);
  }

  // Step 3: Dispatch to specific command handler
  reply = await handleWhatsAppMessage({ from, message });
  return reply;
}

export async function sendWhatsAppMessage(to: string, message: string) {
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
