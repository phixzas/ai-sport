import { NextResponse } from "next/server";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

type ModelSport = "NBA" | "Football";

const modelApiConfiguration = {
  NBA: { environmentVariable: "FORMLY_NBA_API_URL", teamsPath: "/api/teams", predictPath: "/api/predict" },
  Football: { environmentVariable: "FORMLY_FOOTBALL_API_URL", teamsPath: "/teams", predictPath: "/predict" },
} satisfies Record<ModelSport, { environmentVariable: string; teamsPath: string; predictPath: string }>;

export async function forwardModelRequest(
  request: Request,
  sport: ModelSport,
  endpoint: "teams" | "predict",
) {
  const token = getBearerToken(request);
  const user = token ? verifyAuthToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  }

  const configuration = modelApiConfiguration[sport];
  const baseUrl = process.env[configuration.environmentVariable]?.replace(/\/+$/, "");
  if (!baseUrl) {
    return NextResponse.json(
      { error: `${sport} model API is not configured.` },
      { status: 503 },
    );
  }

  const method = endpoint === "teams" ? "GET" : "POST";
  const body = method === "POST" ? await request.text() : undefined;
  try {
    const response = await fetch(
      `${baseUrl}${configuration[endpoint === "teams" ? "teamsPath" : "predictPath"]}`,
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
    if (endpoint === "predict" && response.ok) {
      let input: unknown;
      let result: unknown;
      try {
        input = JSON.parse(body ?? "");
        result = JSON.parse(responseBody);
      } catch (error) {
        console.error(`${sport} model returned an invalid prediction response`, error);
        return NextResponse.json(
          { error: "The model returned an invalid prediction response." },
          { status: 502 },
        );
      }

      try {
        const database = await getDatabase();
        await database.collection("predictions").insertOne({
          userId: user.id,
          sport,
          input,
          result,
          createdAt: new Date(),
        });
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
