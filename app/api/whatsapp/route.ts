import { NextRequest, NextResponse } from "next/server";
import { createAgent } from "../agent/create-agent";

const WHATSAPP_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

export async function GET(req: NextRequest) {
  console.log("GET API called for WhatsApp verification");
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const challenge = searchParams.get("hub.challenge");
  const token = searchParams.get("hub.verify_token");
  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse(null, { status: 403 });
}

export async function POST(req: NextRequest) {
  console.log("POST API called for WhatsApp messages");
  try {
    const body = await req.json();
    // Extract message and sender info from WhatsApp webhook payload
    console.log("Received body:", JSON.stringify(body));
    const message =
      body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body ||
      body?.text?.body;
    const from = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;

    let reply = "Sorry, I didn't understand that.";
    console.log("msg", message, "frm", from);
    if (message && from) {
      // Get the agent instance
      const agent = await createAgent();
      // Use the agent to process the message
      const agentResponse = await agent.invoke({
        input: message,
        userId: from,
      });
      reply = agentResponse?.content || reply;

      // Send reply via WhatsApp Business API
      if (WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
        await fetch(WHATSAPP_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: reply },
          }),
        });
      } else {
        console.error("WhatsApp API credentials are missing.");
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (e) {
    console.log("error occured while parsing", e);
  }
}
