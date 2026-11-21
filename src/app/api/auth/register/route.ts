import { NextResponse } from "next/server";
import { createAuthToken, hashPassword, normalizeEmail } from "@/lib/auth";
import { getAuthConfigurationError } from "@/lib/auth-config";
import { getDatabase } from "@/lib/mongodb";

function isEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Enter an email and password." }, { status: 400 });
  }
  const configurationError = getAuthConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: `Account service is not configured. ${configurationError}` }, { status: 503 });
  }
  const email = normalizeEmail(body.email);
  if (!isEmail(email) || body.password.length < 8 || body.password.length > 128) {
    return NextResponse.json({ error: "Enter a valid email and a password of 8–128 characters." }, { status: 400 });
  }

  try {
    const database = await getDatabase();
    const users = database.collection<{
      email: string;
      passwordSalt: string;
      passwordHash: string;
      createdAt: Date;
    }>("users");
    await users.createIndex({ email: 1 }, { unique: true });

    const credentials = await hashPassword(body.password);
    const result = await users.insertOne({
      email,
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
      createdAt: new Date(),
    });
    const token = createAuthToken({ id: result.insertedId.toString(), email });
    return NextResponse.json({ token, email }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    console.error("Account registration failed", error);
    return NextResponse.json({
      error: "Could not connect to MongoDB Atlas. Check MONGODB_URI and Atlas Network Access for this Render service.",
    }, { status: 503 });
  }
}
