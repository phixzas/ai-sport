import { NextResponse } from "next/server";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import {
  PaymentVerificationError,
  recordVerifiedPayment,
  verifyPaystackPayment,
} from "@/lib/payments";

export async function POST(request: Request) {
  const token = getBearerToken(request);
  const user = token ? verifyAuthToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Your session is invalid. Sign in again." }, { status: 401 });
  }

  let reference: unknown;
  try {
    const body: unknown = await request.json();
    reference = typeof body === "object" && body !== null && "reference" in body
      ? body.reference
      : null;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof reference !== "string" || !reference || reference.length > 100) {
    return NextResponse.json({ error: "A valid payment reference is required." }, { status: 400 });
  }

  let payment;
  try {
    payment = await verifyPaystackPayment(reference);
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Could not verify returned payment", error);
    return NextResponse.json({ error: "Could not verify payment right now." }, { status: 502 });
  }
  if (payment.userId !== user.id) {
    return NextResponse.json({ error: "This payment does not belong to your account." }, { status: 403 });
  }

  try {
    await recordVerifiedPayment(payment);
  } catch (error) {
    console.error("Could not activate subscription after payment", error);
    return NextResponse.json({ error: "Payment was verified, but access could not be activated." }, { status: 500 });
  }

  return NextResponse.json({ verified: true, sport: payment.sport });
}
