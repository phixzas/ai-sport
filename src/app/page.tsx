"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

type Subscription = { sport: string; expires_at: string };
type AuthResponse = { token?: string; email?: string; error?: string };
type SignupProfile = {
  fullName: string;
  phoneNumber: string;
  gender: string;
  country: string;
  region: string;
  city: string;
  streetAddress: string;
  dateOfBirth: string;
};
type FootballPrediction = {
  home_team: string;
  away_team: string;
  expected_home_goals: number;
  expected_away_goals: number;
  home_win_probability_pct: number;
  draw_probability_pct: number;
  away_win_probability_pct: number;
  over_2_5_probability_pct: number;
  under_2_5_probability_pct: number;
  most_likely_score: string;
  most_likely_score_probability_pct: number;
};
type FootballGame = {
  home_team: string;
  away_team: string;
  kickoff: string;
  status: string;
  prediction: FootballPrediction;
};
type NbaPrediction = {
  home_team: string;
  away_team: string;
  line: number;
  predicted_home: number;
  predicted_away: number;
  predicted_total: number;
  edge: number;
  pick: string;
  winner: string | null;
  winner_probability: number | null;
  injuries: {
    home: { report: string; out_count: number };
    away: { report: string; out_count: number };
  };
  rest: {
    home: { days: number; actual_days: number };
    away: { days: number; actual_days: number };
  };
};
type NbaGame = {
  id: string;
  home: string;
  away: string;
  status: string;
  startTime: string | null;
};
type NbaGameOutcome = {
  gameId: string;
  line: number;
  result?: NbaPrediction;
  error?: string;
};
type PredictionHistoryItem =
  | {
      id: string;
      sport: "NBA";
      input: { home_team: string; away_team: string; line: number };
      result: NbaPrediction;
      createdAt: string;
    }
  | {
      id: string;
      sport: "Football";
      input: { home_team: string; away_team: string; kickoff?: string };
      result: FootballPrediction;
      createdAt: string;
    };

function emptySignupProfile(): SignupProfile {
  return {
    fullName: "",
    phoneNumber: "",
    gender: "",
    country: "",
    region: "",
    city: "",
    streetAddress: "",
    dateOfBirth: "",
  };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getApiError(value: unknown) {
  if (!isRecord(value)) return undefined;
  if (typeof value.error === "string") return value.error;
  if (typeof value.detail === "string") return value.detail;
  return undefined;
}

function isFootballPrediction(value: unknown): value is FootballPrediction {
  return isRecord(value) &&
    typeof value.home_team === "string" &&
    typeof value.away_team === "string" &&
    typeof value.expected_home_goals === "number" &&
    typeof value.expected_away_goals === "number" &&
    typeof value.home_win_probability_pct === "number" &&
    typeof value.draw_probability_pct === "number" &&
    typeof value.away_win_probability_pct === "number" &&
    typeof value.over_2_5_probability_pct === "number" &&
    typeof value.under_2_5_probability_pct === "number" &&
    typeof value.most_likely_score === "string" &&
    typeof value.most_likely_score_probability_pct === "number";
}

function isFootballGame(value: unknown): value is FootballGame {
  return isRecord(value) &&
    typeof value.home_team === "string" &&
    typeof value.away_team === "string" &&
    typeof value.kickoff === "string" &&
    typeof value.status === "string" &&
    isFootballPrediction(value.prediction);
}

function isNbaPrediction(value: unknown): value is NbaPrediction {
  if (!isRecord(value) || !isRecord(value.injuries) ||
      !isRecord(value.injuries.home) || !isRecord(value.injuries.away) ||
      !isRecord(value.rest) || !isRecord(value.rest.home) || !isRecord(value.rest.away)) return false;
  return typeof value.home_team === "string" &&
    typeof value.away_team === "string" &&
    typeof value.line === "number" &&
    typeof value.predicted_home === "number" &&
    typeof value.predicted_away === "number" &&
    typeof value.predicted_total === "number" &&
    typeof value.edge === "number" &&
    typeof value.pick === "string" &&
    (typeof value.winner === "string" || value.winner === null) &&
    (typeof value.winner_probability === "number" || value.winner_probability === null) &&
    typeof value.injuries.home.report === "string" &&
    typeof value.injuries.home.out_count === "number" &&
    typeof value.injuries.away.report === "string" &&
    typeof value.injuries.away.out_count === "number" &&
    typeof value.rest.home.days === "number" &&
    typeof value.rest.home.actual_days === "number" &&
    typeof value.rest.away.days === "number" &&
    typeof value.rest.away.actual_days === "number";
}

function isNbaGame(value: unknown): value is NbaGame {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.home === "string" &&
    typeof value.away === "string" &&
    typeof value.status === "string" &&
    (typeof value.startTime === "string" || value.startTime === null);
}

function isPredictionHistoryItem(value: unknown): value is PredictionHistoryItem {
  if (!isRecord(value) || typeof value.id !== "string" ||
      typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt)) ||
      !isRecord(value.input)) return false;
  if (typeof value.input.home_team !== "string" || typeof value.input.away_team !== "string") {
    return false;
  }
  if (value.sport === "NBA") {
    return typeof value.input.line === "number" && isNbaPrediction(value.result);
  }
  if (value.sport === "Football") {
    return (value.input.kickoff === undefined || typeof value.input.kickoff === "string") &&
      isFootballPrediction(value.result);
  }
  return false;
}

async function readAuthResponse(response: Response): Promise<AuthResponse | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    return await response.json() as AuthResponse;
  } catch {
    return null;
  }
}

function Icon({ name, size = 20 }: { name:string; size?:number }) {
  const paths: Record<string, ReactNode> = {
    grid:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    trophy:<><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4"/></>,
    chart:<><path d="M3 3v18h18"/><path d="m7 16 4-5 3 3 6-8"/></>,
    wallet:<><path d="M4 6h16v14H4z"/><path d="M4 6V4h13v2M15 11h5v5h-5a2.5 2.5 0 0 1 0-5Z"/></>,
    user:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    chevron:<path d="m9 18 6-6-6-6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function PredictionHistory({
  items,
  loading,
  error,
  onRefresh,
}: {
  items: PredictionHistoryItem[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  return (
    <>
      <section className="welcome">
        <div><p className="eyebrow">MEMBER DASHBOARD</p><h1>Prediction history</h1></div>
        <button className="secondary-button" type="button" onClick={onRefresh} disabled={loading}>Refresh</button>
      </section>
      <p className="prediction-history-note">Predictions are kept for 7 days and then deleted automatically.</p>
      {error && <p className="form-error dashboard-error" role="alert">{error}</p>}
      {loading ? (
        <p className="nba-games-empty">Loading prediction history…</p>
      ) : items.length === 0 && !error ? (
        <p className="nba-games-empty">No predictions have been saved in the last 7 days.</p>
      ) : (
        <div className="prediction-history-list">
          {items.map(item => (
            <article className="panel prediction-history-card" key={item.id}>
              <div className="prediction-history-heading">
                <p className="eyebrow">{item.sport} · Saved {new Date(item.createdAt).toLocaleString()}</p>
                <h2>{item.sport === "NBA"
                  ? `${item.input.away_team} @ ${item.input.home_team}`
                  : `${item.input.home_team} vs ${item.input.away_team}`}
                </h2>
              </div>
              <div className="prediction-result prediction-history-result">
                {item.sport === "NBA" ? (
                  <>
                    <p>Predicted total <strong>{item.result.predicted_total.toFixed(1)}</strong> · Line <strong>{item.input.line}</strong></p>
                    <p>Pick <strong>{item.result.pick}</strong> · Edge <strong>{item.result.edge > 0 ? "+" : ""}{item.result.edge.toFixed(1)}</strong></p>
                    {item.result.winner && (
                      <p>Likely winner <strong>{item.result.winner}</strong>
                        {item.result.winner_probability !== null
                          ? ` (${(item.result.winner_probability * 100).toFixed(1)}%)`
                          : ""}
                      </p>
                    )}
                    <p>Injuries: {item.result.injuries.home.report || "None reported"} · {item.result.injuries.away.report || "None reported"}</p>
                    <p>Rest: HOME {item.result.rest.home.days} ({item.result.rest.home.actual_days}d)
                      {" · "}AWAY {item.result.rest.away.days} ({item.result.rest.away.actual_days}d)
                    </p>
                  </>
                ) : (
                  <>
                    {item.input.kickoff && <p>Kickoff <strong>{item.input.kickoff} (UK time)</strong></p>}
                    <p>Expected goals <strong>{item.result.expected_home_goals.toFixed(2)} – {item.result.expected_away_goals.toFixed(2)}</strong></p>
                    <p>1X2 <strong>{item.result.home_win_probability_pct.toFixed(1)}% / {item.result.draw_probability_pct.toFixed(1)}% / {item.result.away_win_probability_pct.toFixed(1)}%</strong></p>
                    <p>Over 2.5 <strong>{item.result.over_2_5_probability_pct.toFixed(1)}%</strong> · Under 2.5 <strong>{item.result.under_2_5_probability_pct.toFixed(1)}%</strong></p>
                    <p>Most likely score <strong>{item.result.most_likely_score}</strong></p>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export default function Home() {
  const [sport,setSport] = useState("Football");
  const [period,setPeriod] = useState("30 days");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [userEmail,setUserEmail] = useState<string|null>(null);
  const [accessToken,setAccessToken] = useState<string|null>(null);
  const [subscriptions,setSubscriptions] = useState<Subscription[]>([]);
  const [authLoading,setAuthLoading] = useState(true);
  const [authMode,setAuthMode] = useState<"signIn"|"signUp">("signIn");
  const [signupProfile,setSignupProfile] = useState<SignupProfile>(emptySignupProfile);
  const [activeView,setActiveView] = useState<"overview"|"predictions">("overview");
  const [predictionHistory,setPredictionHistory] = useState<PredictionHistoryItem[]>([]);
  const [predictionHistoryLoading,setPredictionHistoryLoading] = useState(false);
  const [predictionHistoryError,setPredictionHistoryError] = useState("");
  const [predictionHistoryRefresh,setPredictionHistoryRefresh] = useState(0);
  const [message,setMessage] = useState("");
  const [paymentMessage,setPaymentMessage] = useState("");
  const [error,setError] = useState("");
  const [refreshKey,setRefreshKey] = useState(0);
  const [footballGames,setFootballGames] = useState<FootballGame[]>([]);
  const [footballGamesLoading,setFootballGamesLoading] = useState(false);
  const [nbaGames,setNbaGames] = useState<NbaGame[]>([]);
  const [nbaGamesLoading,setNbaGamesLoading] = useState(false);
  const [nbaGameLines,setNbaGameLines] = useState<Record<string,string>>({});
  const [nbaGameOutcomes,setNbaGameOutcomes] = useState<NbaGameOutcome[]>([]);
  const [predictionLoading,setPredictionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const savedToken = window.localStorage.getItem("formly_token");
      if (savedToken) setAccessToken(savedToken);
      else setAuthLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/subscriptions", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const data = await response.json() as { email?: string; subscriptions?: Subscription[]; error?: string };
        if (cancelled) return;
        if (response.status === 401) {
          window.localStorage.removeItem("formly_token");
          setAccessToken(null);
          setUserEmail(null);
          setSubscriptions([]);
          setError("Your sign-in expired. Please sign in again.");
        } else if (!response.ok || !data.email || !data.subscriptions) {
          setError(data.error ?? "Could not load subscription status. Please refresh.");
        } else {
          setUserEmail(data.email);
          setSubscriptions(data.subscriptions);
          setError("");
        }
      } catch {
        if (!cancelled) setError("Could not load subscription status. Please refresh.");
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken,refreshKey]);

  useEffect(() => {
    if (!accessToken || activeView !== "predictions") return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setPredictionHistoryLoading(true);
      setPredictionHistoryError("");
      try {
        const response = await fetch("/api/predictions", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const result: unknown = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setPredictionHistoryError(getApiError(result) ?? "Could not load prediction history.");
          setPredictionHistory([]);
          return;
        }
        if (!Array.isArray(result) || !result.every(isPredictionHistoryItem)) {
          setPredictionHistoryError("The prediction history returned invalid data.");
          setPredictionHistory([]);
          return;
        }
        setPredictionHistory(result);
      } catch {
        if (!cancelled) {
          setPredictionHistoryError("Could not load prediction history. Please try again.");
          setPredictionHistory([]);
        }
      } finally {
        if (!cancelled) setPredictionHistoryLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [accessToken,activeView,predictionHistoryRefresh]);

  useEffect(() => {
    if (!accessToken) return;
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("payment") !== "complete") return;
    const reference = searchParams.get("reference") ?? searchParams.get("trxref");

    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      if (!reference) {
        setError("The payment return did not include a reference. Refresh access before trying to pay again.");
        return;
      }

      try {
        const response = await fetch("/api/payments/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ reference }),
          cache: "no-store",
        });
        const result = await response.json() as {
          verified?: boolean;
          sport?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok || !result.verified ||
            (result.sport !== "NBA" && result.sport !== "Football")) {
          setError(result.error ?? "Could not confirm payment. If you were charged, do not pay again; refresh access shortly.");
          return;
        }

        setSport(result.sport);
        setPaymentMessage(`${result.sport} payment confirmed. Your model access is active.`);
        setError("");
        setRefreshKey(value => value + 1);
        const returnUrl = new URL(window.location.href);
        returnUrl.searchParams.delete("payment");
        returnUrl.searchParams.delete("reference");
        returnUrl.searchParams.delete("trxref");
        window.history.replaceState(window.history.state, "", returnUrl);
      } catch {
        if (!cancelled) {
          setError("Could not confirm payment right now. If you were charged, do not pay again; refresh access shortly.");
        }
      }
    });

    return () => { cancelled = true; };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || sport !== "Football" || !subscriptions.some(item =>
      item.sport === sport && new Date(item.expires_at).getTime() > Date.now())) {
      return;
    }

    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setFootballGamesLoading(true);
      try {
        const response = await fetch("/api/models/football/games", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const result: unknown = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setError(getApiError(result) ?? "Could not load upcoming Football games.");
          setFootballGames([]);
          return;
        }
        if (!isRecord(result) || !Array.isArray(result.fixtures) ||
            !result.fixtures.every(isFootballGame)) {
          setError("The Football model returned invalid fixture data.");
          setFootballGames([]);
          return;
        }
        setFootballGames(result.fixtures);
        setError("");
      } catch {
        if (!cancelled) {
          setError("Could not connect to the Football model API.");
          setFootballGames([]);
        }
      } finally {
        if (!cancelled) setFootballGamesLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [accessToken,sport,subscriptions]);

  useEffect(() => {
    if (!accessToken || sport !== "NBA" || !subscriptions.some(item =>
      item.sport === "NBA" && new Date(item.expires_at).getTime() > Date.now())) {
      return;
    }

    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setNbaGamesLoading(true);
      setError("");
      try {
        const response = await fetch("/api/models/nba/games", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const result: unknown = await response.json();
        if (cancelled) return;
        if (!response.ok || !Array.isArray(result)) {
          setError(getApiError(result) ?? "Could not load upcoming NBA games.");
          setNbaGames([]);
          return;
        }
        const games = result.filter(isNbaGame);
        if (games.length !== result.length) {
          setError("The NBA schedule returned invalid game data.");
          setNbaGames([]);
          return;
        }
        setNbaGames(games);
        setNbaGameLines(current => {
          const next = { ...current };
          for (const game of games) next[game.id] = next[game.id] ?? "226.5";
          return next;
        });
        setNbaGameOutcomes([]);
      } catch {
        if (!cancelled) {
          setError("Could not load upcoming NBA games. Please try again.");
          setNbaGames([]);
        }
      } finally {
        if (!cancelled) setNbaGamesLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [accessToken,sport,subscriptions]);

  async function submitAuth(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const response = await fetch(authMode === "signUp" ? "/api/auth/register" : "/api/auth/login", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(authMode === "signUp"
          ? { email, password, ...signupProfile }
          : { email, password }),
      });
      const result = await readAuthResponse(response);
      if (!result) {
        setError(`The account API is missing from this deployment (HTTP ${response.status}). Deploy the current project to Render as a Web Service, not a Static Site.`);
        return;
      }
      if (!response.ok) {
        setError(result.error ?? `Account request failed (HTTP ${response.status}).`);
        return;
      }
      if (!result.token || !result.email) {
        setError("The account service returned an incomplete response. Check the Render service logs.");
        return;
      }
      window.localStorage.setItem("formly_token",result.token);
      setAccessToken(result.token);
      setPassword("");
      setSignupProfile(emptySignupProfile());
    } catch {
      setError("Could not connect to the account service. Please try again.");
    }
  }

  async function startPayment() {
    setError("");
    if (!accessToken) {
      setError("Sign in before purchasing a subscription.");
      return;
    }
    try {
      const response = await fetch("/api/payments/initialize", {
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${accessToken}`},
        body:JSON.stringify({sport}),
      });
      const result = await response.json() as {authorizationUrl?:string;error?:string};
      if (!response.ok || !result.authorizationUrl) {
        setError(result.error ?? "Could not start payment. Please try again.");
        return;
      }
      window.location.assign(result.authorizationUrl);
    } catch {
      setError("Could not connect to the payment service. Please try again.");
    }
  }

  async function openModel() {
    const active = subscriptions.some(item => item.sport === sport && new Date(item.expires_at).getTime() > Date.now());
    if (!active) {
      await startPayment();
      return;
    }
    document.getElementById("model-predictions")?.scrollIntoView({ behavior: "smooth" });
  }

  async function runNbaPredictions(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      setError("Sign in again before requesting a prediction.");
      return;
    }

    setError("");
    setNbaGameOutcomes([]);
    setPredictionLoading(true);
    const outcomes: NbaGameOutcome[] = [];
    try {
      for (const game of nbaGames) {
        const gameLine = Number(nbaGameLines[game.id]);
        if (!Number.isFinite(gameLine) || gameLine < 180 || gameLine > 260) {
          outcomes.push({
            gameId: game.id,
            line: gameLine,
            error: "Enter a bookmaker total between 180 and 260.",
          });
          setNbaGameOutcomes([...outcomes]);
          continue;
        }

        let outcome: NbaGameOutcome;
        try {
          const response = await fetch("/api/models/nba/predict", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              home_team: game.home,
              away_team: game.away,
              line: gameLine,
            }),
          });
          let result: unknown;
          try {
            result = await response.json();
          } catch {
            outcome = {
              gameId: game.id,
              line: gameLine,
              error: `The NBA service returned a non-JSON response (HTTP ${response.status}). Check that FORMLY_NBA_API_URL points to the FastAPI service, not the Streamlit app.`,
            };
            outcomes.push(outcome);
            setNbaGameOutcomes([...outcomes]);
            continue;
          }
          if (!response.ok) {
            outcome = {
              gameId: game.id,
              line: gameLine,
              error: getApiError(result) ?? `Could not predict ${game.away} @ ${game.home}.`,
            };
          } else if (!isNbaPrediction(result)) {
            outcome = {
              gameId: game.id,
              line: gameLine,
              error: "The NBA model returned an incomplete prediction.",
            };
          } else {
            outcome = { gameId: game.id, line: gameLine, result };
          }
        } catch {
          outcome = {
            gameId: game.id,
            line: gameLine,
            error: `Could not connect to the NBA model for ${game.away} @ ${game.home}.`,
          };
        }
        outcomes.push(outcome);
        setNbaGameOutcomes([...outcomes]);
      }
    } finally {
      setPredictionLoading(false);
    }
  }

  async function signOut() {
    window.localStorage.removeItem("formly_token");
    setAccessToken(null);
    setUserEmail(null);
    setSubscriptions([]);
    setAuthLoading(false);
  }

  if (authLoading) return <div className="auth-page"><div className="auth-card">Loading your account…</div></div>;
  if (!userEmail) return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submitAuth}>
        <div className="brand auth-brand"><div className="brand-mark"><span>S</span></div><span>SportSense AI</span></div>
        <p className="eyebrow">MEMBER ACCESS</p>
        <h1>{authMode === "signIn" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-copy">Sign in to manage subscriptions and access your sports models.</p>
        <label>Email<input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/></label>
        <label>Password<input type="password" autoComplete={authMode === "signIn" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={event=>setPassword(event.target.value)}/></label>
        {authMode === "signUp" && (
          <>
            <label>Full name<input type="text" autoComplete="name" minLength={2} maxLength={120} required value={signupProfile.fullName} onChange={event=>setSignupProfile(current=>({...current,fullName:event.target.value}))}/></label>
            <label>Phone number<input type="tel" autoComplete="tel" maxLength={25} required value={signupProfile.phoneNumber} onChange={event=>setSignupProfile(current=>({...current,phoneNumber:event.target.value}))}/></label>
            <label>Gender (optional)
              <select value={signupProfile.gender} onChange={event=>setSignupProfile(current=>({...current,gender:event.target.value}))}>
                <option value="">Select gender</option>
                <option>Female</option><option>Male</option><option>Non-binary</option><option>Other</option><option>Prefer not to say</option>
              </select>
            </label>
            <label>Country<input type="text" autoComplete="country-name" maxLength={100} required value={signupProfile.country} onChange={event=>setSignupProfile(current=>({...current,country:event.target.value}))}/></label>
            <label>State or region<input type="text" autoComplete="address-level1" maxLength={100} required value={signupProfile.region} onChange={event=>setSignupProfile(current=>({...current,region:event.target.value}))}/></label>
            <label>City<input type="text" autoComplete="address-level2" maxLength={100} required value={signupProfile.city} onChange={event=>setSignupProfile(current=>({...current,city:event.target.value}))}/></label>
            <label>Street address<input type="text" autoComplete="street-address" maxLength={200} required value={signupProfile.streetAddress} onChange={event=>setSignupProfile(current=>({...current,streetAddress:event.target.value}))}/></label>
            <label>Date of birth (optional)<input type="date" autoComplete="bday" value={signupProfile.dateOfBirth} onChange={event=>setSignupProfile(current=>({...current,dateOfBirth:event.target.value}))}/></label>
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-message" role="status">{message}</p>}
        <button className="primary-button auth-submit" type="submit">{authMode === "signIn" ? "Sign in" : "Create account"}</button>
        <button className="auth-switch" type="button" onClick={()=>{setAuthMode(authMode==="signIn"?"signUp":"signIn");setError("");setMessage("");}}>
          {authMode === "signIn" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );

  const activeSubscription = subscriptions.find(item=>item.sport===sport);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><svg viewBox="0 0 32 32"><path d="M16 3v26M3 16h26M7 7l18 18M25 7 7 25"/><circle cx="16" cy="16" r="7"/></svg></div><span>SportSense AI</span></div>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={`nav-item ${activeView === "overview" ? "active" : ""}`} onClick={() => setActiveView("overview")}><Icon name="grid"/><span>Overview</span></button>
          <button className={`nav-item ${activeView === "predictions" ? "active" : ""}`} onClick={() => setActiveView("predictions")}><Icon name="trophy"/><span>Predictions</span></button>
          <button className="nav-item"><Icon name="chart"/><span>Performance</span></button>
          <button className="nav-item"><Icon name="wallet"/><span>Subscription</span></button>
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item"><Icon name="user"/><span>Account</span></button>
          <div className="profile"><div className="avatar">AK</div><div><strong>Ade Kunle</strong><span>Premium member</span></div></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="search"><Icon name="search" size={18}/><input aria-label="Search predictions" placeholder="Search predictions..."/><kbd>⌘ K</kbd></div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Notifications"><Icon name="bell"/><span className="notification-dot"/></button>
            <button className="profile-button" onClick={()=>void signOut()} aria-label={`Sign out ${userEmail}`}><span>{userEmail.slice(0,2).toUpperCase()}</span><Icon name="chevron" size={16}/></button>
          </div>
        </header>

        <div className="content">
          {activeView === "predictions" ? (
            <PredictionHistory
              items={predictionHistory}
              loading={predictionHistoryLoading}
              error={predictionHistoryError}
              onRefresh={() => setPredictionHistoryRefresh(value => value + 1)}
            />
          ) : (
            <>
          <section className="welcome"><div><p className="eyebrow">MEMBER DASHBOARD</p><h1>Welcome back</h1></div><button className="primary-button" onClick={()=>void openModel()}>{activeSubscription?`Get ${sport} predictions`:`Subscribe to ${sport}`}</button></section>

          <section className="sport-tabs" aria-label="Choose sport">
            {["Football","NBA"].map(item => <button key={item} className={sport===item?"selected":""} onClick={()=>{setSport(item);setFootballGames([]);setNbaGames([]);setNbaGameOutcomes([]);setError("");}}>{item}{item==="NBA"?<span className="tab-price">₦10,000</span>:<span className="tab-price">₦50,000</span>}</button>)}
          </section>

          <section className="stats-grid">
            <article className="stat-card"><div className="stat-heading"><span>Winning rate</span><div className="trend">+4.8%</div></div><strong>86.5%</strong><div className="progress"><span style={{width:"86.5%"}}/></div><p>Last 30 predictions</p></article>
            <article className="stat-card"><div className="stat-heading"><span>Profit this month</span><div className="trend">+12.2%</div></div><strong>+₦85,878,869</strong><p>Across all markets</p></article>
            <article className="stat-card access-card"><div className="stat-heading"><span>{sport} access</span><span className={activeSubscription?"active-status":"locked-status"}>{activeSubscription?"Active":"Locked"}</span></div><strong>{activeSubscription?new Date(activeSubscription.expires_at).toLocaleDateString():"No active plan"}</strong><p>{activeSubscription?`Expires after your 30-day access period`:`${sport==="NBA"?"₦10,000":"₦50,000"} for 30 days`}</p></article>
          </section>
          {paymentMessage && <p className="form-message dashboard-message" role="status">{paymentMessage}</p>}
          {error && <p className="form-error dashboard-error" role="alert">{error}</p>}
          <div className="access-refresh"><span>Model access is available only while your selected subscription is active.</span><button className="text-button" onClick={()=>setRefreshKey(value=>value+1)}>Refresh access</button></div>

          <section className="dashboard-grid">
            <article className="panel predictions-panel" id="model-predictions">
              <div className="panel-heading"><div><p className="eyebrow">MODEL ACCESS</p><h2>{sport} predictions</h2></div></div>
              {activeSubscription ? (
                sport === "NBA" ? (
                  <form className="nba-games-form" onSubmit={runNbaPredictions}>
                    <p className="nba-schedule-caption">Upcoming games in the next 24 hours (Eastern Time)</p>
                    {nbaGamesLoading ? (
                      <p className="nba-games-empty">Loading NBA games…</p>
                    ) : nbaGames.length === 0 ? (
                      <p className="nba-games-empty">No NBA games are scheduled in the next 24 hours.</p>
                    ) : (
                      <>
                        <div className="nba-games-list">
                          {nbaGames.map(game => {
                            const outcome = nbaGameOutcomes.find(item => item.gameId === game.id);
                            return (
                              <article className="nba-game-card" key={game.id}>
                                <div>
                                  <h3 className="nba-game-title">{game.away} @ {game.home}</h3>
                                  <p className="nba-game-status">
                                    {game.status}
                                    {game.startTime ? ` · ${new Date(game.startTime).toLocaleString()}` : ""}
                                  </p>
                                </div>
                                <label className="nba-line-field" htmlFor={`nba-line-${game.id}`}>
                                  Bookmaker total line
                                  <input
                                    id={`nba-line-${game.id}`}
                                    type="number"
                                    min="180"
                                    max="260"
                                    step="0.5"
                                    required
                                    value={nbaGameLines[game.id] ?? "226.5"}
                                    onChange={event => {
                                      setNbaGameLines(current => ({ ...current, [game.id]: event.target.value }));
                                      setNbaGameOutcomes(current => current.filter(item => item.gameId !== game.id));
                                    }}
                                  />
                                </label>
                                {outcome?.error && <p className="form-error nba-game-error">{outcome.error}</p>}
                                {outcome?.result && (
                                  <div className="prediction-result nba-game-result" aria-live="polite">
                                    <p>
                                      Predicted total <strong>{outcome.result.predicted_total.toFixed(1)}</strong>
                                      {" · "}Line <strong>{outcome.line}</strong>
                                    </p>
                                    <p>
                                      Pick <strong>{outcome.result.pick}</strong>
                                      {" · "}Edge <strong>{outcome.result.edge > 0 ? "+" : ""}{outcome.result.edge.toFixed(1)}</strong>
                                    </p>
                                    {outcome.result.winner && (
                                      <p>
                                        Likely winner <strong>{outcome.result.winner}</strong>
                                        {outcome.result.winner_probability !== null
                                          ? ` (${(outcome.result.winner_probability * 100).toFixed(1)}%)`
                                          : ""}
                                      </p>
                                    )}
                                    <p>
                                      Injuries: {game.home} — {outcome.result.injuries.home.report || "None reported"};
                                      {" "}{game.away} — {outcome.result.injuries.away.report || "None reported"}
                                    </p>
                                    <p>
                                      Rest: HOME {outcome.result.rest.home.days} ({outcome.result.rest.home.actual_days}d)
                                      {" · "}AWAY {outcome.result.rest.away.days} ({outcome.result.rest.away.actual_days}d)
                                    </p>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                        <button className="primary-button nba-predict-button" type="submit" disabled={predictionLoading}>
                          {predictionLoading ? "Predicting games…" : "Predict all games"}
                        </button>
                      </>
                    )}
                  </form>
                ) : (
                  <div className="football-games-form">
                    <p className="nba-schedule-caption">Upcoming games and model predictions in the next 24 hours (UK time)</p>
                    {footballGamesLoading ? (
                      <p className="nba-games-empty">Loading Football games…</p>
                    ) : footballGames.length === 0 ? (
                      <p className="nba-games-empty">No Football games are scheduled in the next 24 hours.</p>
                    ) : (
                      <div className="nba-games-list">
                        {footballGames.map(game => (
                          <article className="football-game-card" key={`${game.kickoff}-${game.home_team}-${game.away_team}`}>
                            <h3 className="nba-game-title">{game.home_team} vs {game.away_team}</h3>
                            <p className="nba-game-status">{game.status} · {game.kickoff} (UK time)</p>
                            <div className="prediction-result football-game-result" aria-live="polite">
                              <p>Expected goals <strong>{game.prediction.expected_home_goals.toFixed(2)} – {game.prediction.expected_away_goals.toFixed(2)}</strong></p>
                              <p>1X2 <strong>{game.prediction.home_win_probability_pct.toFixed(1)}% / {game.prediction.draw_probability_pct.toFixed(1)}% / {game.prediction.away_win_probability_pct.toFixed(1)}%</strong></p>
                              <p>Over 2.5 <strong>{game.prediction.over_2_5_probability_pct.toFixed(1)}%</strong> · Under 2.5 <strong>{game.prediction.under_2_5_probability_pct.toFixed(1)}%</strong></p>
                              <p>Most likely score <strong>{game.prediction.most_likely_score}</strong></p>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="locked-preview">
                  <strong>Predictions are for subscribers</strong>
                  <span>Subscribe to {sport} to request predictions from the model API.</span>
                  <button className="text-button" onClick={()=>void startPayment()}>Subscribe for {sport==="NBA"?"₦10,000":"₦50,000"} <Icon name="chevron" size={16}/></button>
                </div>
              )}
            </article>

            <aside className="right-column">
              <article className="panel performance-panel">
                <div className="panel-heading"><h2>Performance</h2><select aria-label="Performance period" value={period} onChange={e=>setPeriod(e.target.value)}><option>30 days</option><option>7 days</option><option>90 days</option></select></div>
                <div className="chart">
                  <div className="chart-labels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span></div>
                  <svg viewBox="0 0 360 170" preserveAspectRatio="none">
                    <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6c5ce7" stopOpacity=".28"/><stop offset="100%" stopColor="#6c5ce7" stopOpacity="0"/></linearGradient></defs>
                    <path className="grid-line" d="M0 28H360M0 70H360M0 112H360M0 154H360"/>
                    <path className="area" d="M0 132 C30 118 48 126 72 108 S115 94 135 102 S175 88 198 94 S238 68 260 78 S300 48 360 38 L360 170 L0 170Z"/>
                    <path className="chart-line" d="M0 132 C30 118 48 126 72 108 S115 94 135 102 S175 88 198 94 S238 68 260 78 S300 48 360 38"/>
                    <circle cx="360" cy="38" r="5"/>
                  </svg>
                  <div className="chart-dates"><span>Oct 22</span><span>Oct 29</span><span>Nov 5</span><span>Nov 12</span><span>Nov 21</span></div>
                </div>
              </article>
              <article className="panel plan-panel"><div><p className="eyebrow">CURRENT PLAN</p><h2>{sport} Premium</h2></div><div className="plan-price">{sport==="NBA"?"₦10,000":"₦50,000"}<span>/30 days</span></div><button className="secondary-button">Manage subscription</button></article>
            </aside>
          </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
