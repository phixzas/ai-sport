import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";

const pricesKobo = {
  NBA: 1_000_000,
  Football: 5_000_000,
} as const;

type Sport = keyof typeof pricesKobo;

export async function POST(request: Request) {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

  if (!paystackSecret) {
    return NextResponse.json({ error: "Payment service is not configured." }, { status: 503 });
  }

  const token = getBearerToken(request);
  const user = token ? verifyAuthToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Your session is invalid. Sign in again." }, { status: 401 });
  }

  let sport: Sport;
  try {
    const body: unknown = await request.json();
    const requestedSport = typeof body === "object" && body !== null && "sport" in body
      ? body.sport
      : null;
    if (requestedSport !== "NBA" && requestedSport !== "Football") {
      return NextResponse.json({ error: "Choose a valid subscription." }, { status: 400 });
    }
    sport = requestedSport;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const reference = `formly_${randomUUID()}`;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const configuredOrigin = process.env.RENDER_EXTERNAL_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const origin = forwardedHost &&
    (forwardedProtocol === "http" || forwardedProtocol === "https")
    ? new URL(`${forwardedProtocol}://${forwardedHost}`)
    : new URL(configuredOrigin ?? request.url);
  const callbackUrl = new URL("/", origin);
  callbackUrl.searchParams.set("payment", "complete");
  const paymentResponse = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      amount: pricesKobo[sport],
      currency: "NGN",
      reference,
      callback_url: callbackUrl.toString(),
      metadata: { user_id: user.id, sport },
    }),
    cache: "no-store",
  });
  const payment = await paymentResponse.json() as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string };
  };
  if (!paymentResponse.ok || !payment.status || !payment.data?.authorization_url) {
    console.error("Paystack initialization failed", payment.message ?? paymentResponse.statusText);
    return NextResponse.json({ error: "Could not start payment. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ authorizationUrl: payment.data.authorization_url });
}
