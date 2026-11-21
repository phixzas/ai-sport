import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getMongoClient } from "@/lib/mongodb";

const pricesKobo = {
  NBA: 1_000_000,
  Football: 5_000_000,
} as const;

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
  const databaseName = process.env.MONGODB_DB_NAME;
  if (!reference || !databaseName) {
    return NextResponse.json({ error: "Payment verification is not configured." }, { status: 503 });
  }

  const verificationResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" },
  );
  const verification = await verificationResponse.json() as {
    status?: boolean;
    data?: {
      status?: string;
      reference?: string;
      amount?: number;
      currency?: string;
      metadata?: { user_id?: string; sport?: string };
    };
  };
  const data = verification.data;
  const sport = data?.metadata?.sport;
  if (!verificationResponse.ok || !verification.status || !data || data.status !== "success" ||
      data.reference !== reference || data.currency !== "NGN" ||
      (sport !== "NBA" && sport !== "Football") ||
      typeof data.amount !== "number" || typeof data.metadata?.user_id !== "string") {
    return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
  }
  const userId = data.metadata.user_id;
  const amountKobo = data.amount;
  if (amountKobo !== pricesKobo[sport]) {
    return NextResponse.json({ error: "Payment amount does not match the selected plan." }, { status: 400 });
  }

  const client = await getMongoClient();
  const database = client.db(databaseName);
  const payments = database.collection<{
    _id: string;
    userId: string;
    sport: string;
    amountKobo: number;
    createdAt: Date;
  }>("payments");
  const subscriptions = database.collection<{
    userId: string;
    sport: string;
    expiresAt: Date;
    updatedAt: Date;
  }>("subscriptions");
  await subscriptions.createIndex({ userId: 1, sport: 1 }, { unique: true });
  const session = client.startSession();
  const now = new Date();
  try {
    await session.withTransaction(async () => {
      await payments.insertOne({
        _id: reference,
        userId,
        sport,
        amountKobo,
        createdAt: now,
      }, { session });

      const current = await subscriptions.findOne(
        { userId, sport },
        { session },
      );
      const currentExpiry = current?.expiresAt instanceof Date && current.expiresAt > now
        ? current.expiresAt
        : now;
      const expiresAt = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
      await subscriptions.updateOne(
        { userId, sport },
        { $set: { expiresAt, updatedAt: now } },
        { upsert: true, session },
      );
    });
  } catch (error) {
    const alreadyProcessed = await payments.findOne({ _id: reference });
    if (alreadyProcessed) return NextResponse.json({ received: true });
    console.error("Could not record verified payment", error);
    return NextResponse.json({ error: "Could not record subscription." }, { status: 500 });
  } finally {
    await session.endSession();
  }

  return NextResponse.json({ received: true });
}
