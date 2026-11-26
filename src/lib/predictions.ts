import { getDatabase } from "@/lib/mongodb";

export const predictionRetentionMilliseconds = 7 * 24 * 60 * 60 * 1000;

export async function getPredictionsCollection() {
  const predictions = (await getDatabase()).collection("predictions");
  await predictions.createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: predictionRetentionMilliseconds / 1000 },
  );
  await predictions.createIndex({ userId: 1, createdAt: -1 });
  return predictions;
}
