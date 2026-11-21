import { NextResponse } from "next/server";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

export async function GET(request: Request) {
  const token = getBearerToken(request);
  const user = token ? verifyAuthToken(token) : null;
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  try {
    const database = await getDatabase();
    const subscriptions = await database.collection("subscriptions")
      .find({ userId: user.id, expiresAt: { $gt: new Date() } })
      .project({ _id: 0, sport: 1, expiresAt: 1 })
      .toArray();
    return NextResponse.json({
      email: user.email,
      subscriptions: subscriptions.map(({ sport, expiresAt }) => ({
        sport,
        expires_at: (expiresAt as Date).toISOString(),
      })),
    });
  } catch (error) {
    console.error("Subscription lookup failed", error);
    return NextResponse.json({ error: "Could not load subscription status." }, { status: 503 });
  }
}
