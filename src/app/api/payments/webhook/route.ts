import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  PaymentVerificationError,
  recordVerifiedPayment,
  verifyPaystackPayment,
} from "@/lib/payments";

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = request.headers.get("x-paystack-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "Invalid webhook configuration." }, { status: 401 });
  }

  const rawBody = await request.text();
  const expected = createHmac("sha512", secret).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const reference = event.data?.reference;
  if (!reference) {
    return NextResponse.json({ error: "Payment verification is not configured." }, { status: 503 });
  }

  let payment;
  try {
    payment = await verifyPaystackPayment(reference);
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Could not verify Paystack payment", error);
    return NextResponse.json({ error: "Could not verify payment." }, { status: 502 });
  }

  try {
    await recordVerifiedPayment(payment);
  } catch (error) {
    console.error("Could not record verified payment", error);
    return NextResponse.json({ error: "Could not record subscription." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
