import { getMongoClient } from "@/lib/mongodb";

export const pricesKobo = {
  NBA: 1_000_000,
  Football: 5_000_000,
} as const;

export type PaymentSport = keyof typeof pricesKobo;

export type VerifiedPayment = {
  reference: string;
  userId: string;
  sport: PaymentSport;
  amountKobo: number;
};

export class PaymentVerificationError extends Error {}

export async function verifyPaystackPayment(reference: string): Promise<VerifiedPayment> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not configured.");

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" },
  );
  const verification = await response.json() as {
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
  if (!response.ok || !verification.status || !data || data.status !== "success" ||
      data.reference !== reference || data.currency !== "NGN" ||
      (sport !== "NBA" && sport !== "Football") ||
      typeof data.amount !== "number" || typeof data.metadata?.user_id !== "string") {
    throw new PaymentVerificationError("Payment could not be verified.");
  }
  if (data.amount !== pricesKobo[sport]) {
    throw new PaymentVerificationError("Payment amount does not match the selected plan.");
  }

  return {
    reference,
    userId: data.metadata.user_id,
    sport,
    amountKobo: data.amount,
  };
}

export async function recordVerifiedPayment(payment: VerifiedPayment) {
  const databaseName = process.env.MONGODB_DB_NAME;
  if (!databaseName) throw new Error("MONGODB_DB_NAME is not configured.");

  const client = await getMongoClient();
  const database = client.db(databaseName);
  const payments = database.collection<VerifiedPayment & { _id: string; createdAt: Date }>("payments");
  const subscriptions = database.collection<{
    userId: string;
    sport: PaymentSport;
    expiresAt: Date;
    updatedAt: Date;
  }>("subscriptions");
  await subscriptions.createIndex({ userId: 1, sport: 1 }, { unique: true });

  const session = client.startSession();
  const now = new Date();
  try {
    await session.withTransaction(async () => {
      await payments.insertOne({
        ...payment,
        _id: payment.reference,
        createdAt: now,
      }, { session });

      const current = await subscriptions.findOne(
        { userId: payment.userId, sport: payment.sport },
        { session },
      );
      const currentExpiry = current?.expiresAt instanceof Date && current.expiresAt > now
        ? current.expiresAt
        : now;
      const expiresAt = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
      await subscriptions.updateOne(
        { userId: payment.userId, sport: payment.sport },
        { $set: { expiresAt, updatedAt: now } },
        { upsert: true, session },
      );
    });
  } catch (error) {
    const alreadyProcessed = await payments.findOne({ _id: payment.reference });
    if (alreadyProcessed) {
      if (alreadyProcessed.userId === payment.userId &&
          alreadyProcessed.sport === payment.sport &&
          alreadyProcessed.amountKobo === payment.amountKobo) return;
      throw new Error("Payment reference was already recorded with different details.", { cause: error });
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
