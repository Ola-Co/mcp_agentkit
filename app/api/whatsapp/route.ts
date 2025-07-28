import { NextRequest, NextResponse } from 'next/server';
import { createAgent } from '../agent/create-agent';

const WHATSAPP_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

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

    try {
      // Get the agent instance
      const agent = await createAgent();

      // Create a unique thread ID for this conversation
      // const threadId = `whatsapp_${from}_${Date.now()}`;

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
        // You might also want to clear the checkpoint here
      }

      console.log('Invoking agent with thread ID:', threadId);

      // Use the agent to process the message with proper configuration
      const agentResponse = await agent.invoke(
        {
          input: message,
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

      console.log('Processed reply:', reply);
    } catch (agentError) {
      console.error('Error processing message with agent:', agentError);
      reply =
        "I'm experiencing some technical difficulties. Please try again later.";
    }

    // Send reply via WhatsApp Business API
    try {
      if (WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
        console.log('Sending WhatsApp reply to:', from);

        const whatsappResponse = await fetch(WHATSAPP_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: from,
            type: 'text',
            text: { body: reply },
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

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Error in POST handler:', error);

    // Make sure to always return a response
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
