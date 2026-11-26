import type { Collection, Document } from "mongodb";

type ScoreboardSport = "NBA" | "Football";
type MatchResult = {
  status: "In Progress" | "Final";
  homeScore: number;
  awayScore: number;
  updatedAt: Date;
};

const nbaTeamAliases: Record<string, string> = {
  GS: "GSW",
  WSH: "WAS",
  NO: "NOP",
  NY: "NYK",
  SA: "SAS",
  UTAH: "UTA",
};

const footballTeamAliases: Record<string, string> = {
  "brighton and hove albion": "brighton",
  "brighton & hove albion": "brighton",
  "brighton hove albion": "brighton",
  "leeds united": "leeds",
  "man city": "manchester city",
  "manchester city": "manchester city",
  "man united": "manchester united",
  "man utd": "manchester united",
  "manchester united": "manchester united",
  "newcastle united": "newcastle",
  "nott'm forest": "nottingham forest",
  "nottm forest": "nottingham forest",
  "nottingham forest": "nottingham forest",
  "tottenham": "tottenham hotspur",
  "tottenham hotspur": "tottenham hotspur",
  "west ham": "west ham united",
  "west ham united": "west ham united",
  "wolverhampton wanderers": "wolves",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function dateInTimeZone(value: unknown, timeZone: string) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  const day = parts.find(part => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function addDays(date: string, amount: number) {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + amount);
  return shifted.toISOString().slice(0, 10);
}

function normalizeFootballTeam(value: string) {
  const name = value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  return footballTeamAliases[name] ?? name;
}

function normalizeNbaTeam(value: string) {
  const abbreviation = value.toUpperCase();
  return nbaTeamAliases[abbreviation] ?? abbreviation;
}

function scoreFrom(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 ? score : null;
}

function requestedDates(sport: ScoreboardSport, record: Document) {
  const input = isRecord(record.input) ? record.input : {};
  if (sport === "Football") {
    if (typeof input.kickoff === "string" && /^\d{4}-\d{2}-\d{2}/.test(input.kickoff)) {
      return [input.kickoff.slice(0, 10)];
    }
    return [];
  }

  const createdAt = record.createdAt instanceof Date
    ? record.createdAt.toISOString()
    : typeof record.createdAt === "string" ? record.createdAt : null;
  const date = dateInTimeZone(
    typeof input.start_time === "string" ? input.start_time : createdAt,
    "America/New_York",
  );
  if (!date) return [];
  return typeof input.start_time === "string" ? [date] : [date, addDays(date, 1)];
}

async function fetchScoreboard(sport: ScoreboardSport, date: string) {
  const url = new URL(sport === "NBA"
    ? "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
    : "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard");
  url.searchParams.set("dates", date.replace(/-/g, ""));
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Scoreboard returned HTTP ${response.status}.`);
  const data: unknown = await response.json();
  if (!isRecord(data) || !Array.isArray(data.events)) {
    throw new Error("Scoreboard returned invalid data.");
  }
  return data.events;
}

function getMatchResult(sport: ScoreboardSport, record: Document, events: unknown[]): MatchResult | null {
  const input = isRecord(record.input) ? record.input : {};
  const homeTeam = typeof input.home_team === "string" ? input.home_team : "";
  const awayTeam = typeof input.away_team === "string" ? input.away_team : "";
  const gameId = typeof input.game_id === "string" ? input.game_id : null;

  for (const event of events) {
    if (!isRecord(event) || typeof event.id !== "string") continue;
    if (sport === "NBA" && gameId && event.id !== gameId) continue;

    const status = isRecord(event.status) && isRecord(event.status.type)
      ? event.status.type
      : null;
    if (!status || (status.state !== "in" && status.state !== "post")) continue;
    const competition = Array.isArray(event.competitions) && isRecord(event.competitions[0])
      ? event.competitions[0]
      : null;
    const competitors = competition && Array.isArray(competition.competitors)
      ? competition.competitors
      : [];
    const home = competitors.find(team => isRecord(team) && team.homeAway === "home");
    const away = competitors.find(team => isRecord(team) && team.homeAway === "away");
    if (!isRecord(home) || !isRecord(away)) continue;
    const homeData = isRecord(home.team) ? home.team : {};
    const awayData = isRecord(away.team) ? away.team : {};
    const homeName = sport === "NBA"
      ? (typeof homeData.abbreviation === "string" ? normalizeNbaTeam(homeData.abbreviation) : "")
      : (typeof homeData.displayName === "string" ? normalizeFootballTeam(homeData.displayName) : "");
    const awayName = sport === "NBA"
      ? (typeof awayData.abbreviation === "string" ? normalizeNbaTeam(awayData.abbreviation) : "")
      : (typeof awayData.displayName === "string" ? normalizeFootballTeam(awayData.displayName) : "");
    if (homeName !== (sport === "NBA" ? normalizeNbaTeam(homeTeam) : normalizeFootballTeam(homeTeam)) ||
        awayName !== (sport === "NBA" ? normalizeNbaTeam(awayTeam) : normalizeFootballTeam(awayTeam))) {
      continue;
    }

    const homeScore = scoreFrom(home.score);
    const awayScore = scoreFrom(away.score);
    if (homeScore === null || awayScore === null) continue;
    return {
      status: status.state === "post" ? "Final" : "In Progress",
      homeScore,
      awayScore,
      updatedAt: new Date(),
    };
  }
  return null;
}

function sameScore(previous: unknown, next: MatchResult) {
  return isRecord(previous) &&
    previous.status === next.status &&
    previous.homeScore === next.homeScore &&
    previous.awayScore === next.awayScore;
}

export async function refreshPredictionResults(
  predictions: Collection<Document>,
  records: Document[],
) {
  const boards = new Map<string, unknown[]>();
  const failures: string[] = [];

  for (const sport of ["NBA", "Football"] as const) {
    const sportRecords = records.filter(record =>
      record.sport === sport &&
      !(isRecord(record.actualResult) && record.actualResult.status === "Final"),
    );
    const dates = new Set(sportRecords.flatMap(record => requestedDates(sport, record)));
    const settled = await Promise.all([...dates].map(async date => {
      try {
        return { date, events: await fetchScoreboard(sport, date), ok: true as const };
      } catch (error) {
        console.error(`Could not refresh ${sport} scores for ${date}`, error);
        return { date, ok: false as const };
      }
    }));

    for (const result of settled) {
      if (result.ok) boards.set(`${sport}:${result.date}`, result.events);
      else failures.push(sport);
    }

    for (const record of sportRecords) {
      const input = isRecord(record.input) ? record.input : {};
      const eventDate = sport === "Football"
        ? (typeof input.kickoff === "string" ? input.kickoff.slice(0, 10) : "")
        : requestedDates(sport, record)[0];
      const datesToCheck = sport === "NBA" && typeof input.start_time !== "string"
        ? requestedDates(sport, record)
        : eventDate ? [eventDate] : [];
      const events = datesToCheck.flatMap(date => boards.get(`${sport}:${date}`) ?? []);
      const actualResult = getMatchResult(sport, record, events);
      if (!actualResult || sameScore(record.actualResult, actualResult)) continue;
      await predictions.updateOne(
        { _id: record._id },
        { $set: { actualResult } },
      );
      record.actualResult = actualResult;
    }
  }

  const uniqueFailures = [...new Set(failures)];
  return uniqueFailures.length > 0
    ? `Could not refresh ${uniqueFailures.join(" and ")} scores.`
    : null;
}
