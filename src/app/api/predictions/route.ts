import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { getPredictionsCollection, predictionRetentionMilliseconds } from "@/lib/predictions";
import { refreshPredictionResults } from "@/lib/prediction-results";

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
    const scoreUpdateError = await refreshPredictionResults(predictions, history);
    return NextResponse.json({
      predictions: history.map(({ _id, sport, input, result, createdAt, actualResult }) => ({
        id: _id.toString(),
        sport,
        input,
        result,
        actualResult: actualResult
          ? {
              ...actualResult,
              updatedAt: actualResult.updatedAt instanceof Date
                ? actualResult.updatedAt.toISOString()
                : actualResult.updatedAt,
            }
          : null,
        createdAt: createdAt.toISOString(),
      })),
      scoreUpdateError,
    });
  } catch (error) {
    console.error("Prediction history lookup failed", error);
    return NextResponse.json({ error: "Could not load prediction history." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const token = getBearerToken(request);
  const user = token ? verifyAuthToken(token) : null;
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null ||
      !("id" in body) || typeof body.id !== "string" ||
      !/^[a-f\d]{24}$/i.test(body.id)) {
    return NextResponse.json({ error: "A valid prediction ID is required." }, { status: 400 });
  }

  try {
    const predictions = await getPredictionsCollection();
    const deleted = await predictions.deleteOne({
      _id: new ObjectId(body.id),
      userId: user.id,
    });
    if (deleted.deletedCount === 0) {
      return NextResponse.json({ error: "Prediction not found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Prediction deletion failed", error);
    return NextResponse.json({ error: "Could not delete prediction." }, { status: 503 });
  }
}
