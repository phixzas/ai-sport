import { NextResponse } from "next/server";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { getPredictionsCollection, predictionRetentionMilliseconds } from "@/lib/predictions";

export async function GET(request: Request) {
  const token = getBearerToken(request);
  const user = token ? verifyAuthToken(token) : null;
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  try {
    const predictions = await getPredictionsCollection();
    const cutoff = new Date(Date.now() - predictionRetentionMilliseconds);
    const history = await predictions.find({
      userId: user.id,
      createdAt: { $gte: cutoff },
    }).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(history.map(({ _id, sport, input, result, createdAt }) => ({
      id: _id.toString(),
      sport,
      input,
      result,
      createdAt: createdAt.toISOString(),
    })));
  } catch (error) {
    console.error("Prediction history lookup failed", error);
    return NextResponse.json({ error: "Could not load prediction history." }, { status: 503 });
  }
}
