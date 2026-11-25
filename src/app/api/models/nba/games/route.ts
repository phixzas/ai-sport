import { NextResponse } from "next/server";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

const espnToNbaAbbreviation: Record<string, string> = {
  GS: "GSW",
  WSH: "WAS",
  NO: "NOP",
  NY: "NYK",
  SA: "SAS",
  UTAH: "UTA",
  PHX: "PHX",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function easternDate(offsetDays: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find(part => part.type === "year")?.value);
  const month = Number(parts.find(part => part.type === "month")?.value);
  const day = Number(parts.find(part => part.type === "day")?.value);
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  const user = token ? verifyAuthToken(token) : null;
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  try {
    const database = await getDatabase();
    const subscription = await database.collection("subscriptions").findOne({
      userId: user.id,
      sport: "NBA",
      expiresAt: { $gt: new Date() },
    });
    if (!subscription) {
      return NextResponse.json({ error: "An active NBA subscription is required." }, { status: 403 });
    }
  } catch (error) {
    console.error("NBA schedule access check failed", error);
    return NextResponse.json({ error: "Could not verify NBA access." }, { status: 503 });
  }

  try {
    const dates = [easternDate(0), easternDate(1)];
    const scoreboards = await Promise.all(dates.map(async date => {
      const scoreboardUrl = new URL("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard");
      scoreboardUrl.searchParams.set("dates", date.replace(/-/g, ""));
      const response = await fetch(scoreboardUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`ESPN scoreboard returned HTTP ${response.status}.`);
      const result: unknown = await response.json();
      if (!isRecord(result) || !Array.isArray(result.events)) {
        throw new Error("ESPN returned an invalid scoreboard response.");
      }
      return result.events;
    }));

    const games = new Map<string, {
      id: string;
      home: string;
      away: string;
      status: string;
      startTime: string | null;
    }>();
    for (const events of scoreboards) {
      for (const value of events) {
        if (!isRecord(value) || typeof value.id !== "string") continue;
        const status = isRecord(value.status) && isRecord(value.status.type)
          ? value.status.type
          : {};
        const description = typeof status.description === "string" ? status.description : "Scheduled";
        if (status.state === "post" || description.includes("Final")) continue;
        const competition = Array.isArray(value.competitions) && isRecord(value.competitions[0])
          ? value.competitions[0]
          : null;
        const competitors = competition && Array.isArray(competition.competitors)
          ? competition.competitors
          : [];
        const home = competitors.find(team =>
          isRecord(team) && team.homeAway === "home",
        );
        const away = competitors.find(team =>
          isRecord(team) && team.homeAway === "away",
        );
        const homeTeam = isRecord(home) && isRecord(home.team) ? home.team : null;
        const awayTeam = isRecord(away) && isRecord(away.team) ? away.team : null;
        const homeAbbreviation = homeTeam && typeof homeTeam.abbreviation === "string"
          ? homeTeam.abbreviation
          : null;
        const awayAbbreviation = awayTeam && typeof awayTeam.abbreviation === "string"
          ? awayTeam.abbreviation
          : null;
        if (!homeAbbreviation || !awayAbbreviation) continue;

        games.set(value.id, {
          id: value.id,
          home: espnToNbaAbbreviation[homeAbbreviation] ?? homeAbbreviation,
          away: espnToNbaAbbreviation[awayAbbreviation] ?? awayAbbreviation,
          status: description,
          startTime: typeof value.date === "string" ? value.date : null,
        });
      }
    }

    return NextResponse.json([...games.values()]);
  } catch (error) {
    console.error("Could not load NBA games", error);
    return NextResponse.json({ error: "Could not load the NBA schedule. Please try again." }, { status: 502 });
  }
}
