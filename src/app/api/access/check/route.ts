import { NextResponse } from "next/server";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

const sports = new Set(["NBA", "Football"]);

export async function POST(request: Request) {
  const token = getBearerToken(request);
  const user = token ? verifyAuthToken(token) : null;
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  let body: { sport?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.sport !== "string" || !sports.has(body.sport)) {
    return NextResponse.json({ error: "Invalid sport." }, { status: 400 });
  }

  try {
    const database = await getDatabase();
    const subscription = await database.collection("subscriptions").findOne({
      userId: user.id,
      sport: body.sport,
      expiresAt: { $gt: new Date() },
    });
    return NextResponse.json({
      active: Boolean(subscription),
      expiresAt: subscription?.expiresAt instanceof Date ? subscription.expiresAt.toISOString() : null,
    });
  } catch (error) {
    console.error("Model access check failed", error);
    return NextResponse.json({ error: "Could not verify model access." }, { status: 503 });
  }
}
