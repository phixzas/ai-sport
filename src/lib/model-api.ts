import { NextResponse } from "next/server";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { getPredictionsCollection } from "@/lib/predictions";

type ModelSport = "NBA" | "Football";

const modelApiConfiguration = {
  NBA: { environmentVariable: "FORMLY_NBA_API_URL", teamsPath: "/api/teams", predictPath: "/api/predict" },
  Football: {
    environmentVariable: "FORMLY_FOOTBALL_API_URL",
    teamsPath: "/teams",
    predictPath: "/predict",
    gamesPath: "/api/fixtures",
  },
} satisfies Record<ModelSport, { environmentVariable: string; teamsPath: string; predictPath: string; gamesPath?: string }>;

type ScheduledFootballPrediction = {
  input: { home_team: string; away_team: string; kickoff: string };
  result: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function forwardModelRequest(
  request: Request,
  sport: ModelSport,
  endpoint: "teams" | "predict" | "games",
) {
  const token = getBearerToken(request);
  const user = token ? verifyAuthToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  }

  const configuration = modelApiConfiguration[sport];
  const path = endpoint === "games"
    ? ("gamesPath" in configuration ? configuration.gamesPath : null)
    : configuration[endpoint === "teams" ? "teamsPath" : "predictPath"];
  if (!path) {
    return NextResponse.json(
      { error: `${sport} games endpoint is not configured.` },
      { status: 503 },
    );
  }

  const baseUrl = process.env[configuration.environmentVariable]?.replace(/\/+$/, "");
  if (!baseUrl) {
    return NextResponse.json(
      { error: `${sport} model API is not configured.` },
      { status: 503 },
    );
  }

  const method = endpoint === "predict" ? "POST" : "GET";
  const body = method === "POST" ? await request.text() : undefined;
  try {
    const response = await fetch(
      `${baseUrl}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      },
    );
    const responseBody = await response.text();
    if ((endpoint === "predict" || endpoint === "games") && response.ok) {
      let input: unknown;
      let result: unknown;
      const scheduledPredictions: ScheduledFootballPrediction[] = [];
      try {
        result = JSON.parse(responseBody);
        if (endpoint === "predict") {
          input = JSON.parse(body ?? "");
        } else {
          if (!isRecord(result) || !Array.isArray(result.fixtures)) {
            throw new Error("The Football model returned invalid fixture data.");
          }
          for (const fixture of result.fixtures) {
            if (!isRecord(fixture) || typeof fixture.home_team !== "string" ||
                typeof fixture.away_team !== "string" || typeof fixture.kickoff !== "string" ||
                !isRecord(fixture.prediction)) {
              throw new Error("The Football model returned invalid fixture data.");
            }
            scheduledPredictions.push({
              input: {
                home_team: fixture.home_team,
                away_team: fixture.away_team,
                kickoff: fixture.kickoff,
              },
              result: fixture.prediction,
            });
          }
        }
      } catch (error) {
        console.error(`${sport} model returned invalid prediction data`, error);
        return NextResponse.json(
          { error: "The model returned invalid prediction data." },
          { status: 502 },
        );
      }

      try {
        const predictions = await getPredictionsCollection();
        if (endpoint === "predict") {
          await predictions.insertOne({
            userId: user.id,
            sport,
            input,
            result,
            createdAt: new Date(),
          });
        } else if (scheduledPredictions.length > 0) {
          const createdAt = new Date();
          await predictions.bulkWrite(scheduledPredictions.map(prediction => ({
            updateOne: {
              filter: {
                userId: user.id,
                sport,
                "input.home_team": prediction.input.home_team,
                "input.away_team": prediction.input.away_team,
                "input.kickoff": prediction.input.kickoff,
              },
              update: {
                $set: {
                  userId: user.id,
                  sport,
                  input: prediction.input,
                  result: prediction.result,
                  createdAt,
                },
              },
              upsert: true,
            },
          })));
        }
      } catch (error) {
        console.error(`Could not save ${sport} prediction`, error);
        return NextResponse.json(
          { error: "The prediction was generated but could not be saved. Please try again." },
          { status: 503 },
        );
      }
    }

    return new Response(responseBody, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(`Could not reach the ${sport} model API`, error);
    return NextResponse.json(
      { error: `${sport} model API is unavailable. Check that the service is running.` },
      { status: 502 },
    );
  }
}
