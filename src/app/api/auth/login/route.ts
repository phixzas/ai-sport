import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { createAuthToken, normalizeEmail, verifyPassword } from "@/lib/auth";
import { getAuthConfigurationError } from "@/lib/auth-config";
import { getDatabase } from "@/lib/mongodb";

const dummySalt = "formly-login-dummy-salt";
const dummyHash = "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.email !== "string" || typeof body.password !== "string" ||
      body.password.length < 1 || body.password.length > 128) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  const configurationError = getAuthConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: `Account service is not configured. ${configurationError}` }, { status: 503 });
  }

  const email = normalizeEmail(body.email);
  try {
    const database = await getDatabase();
    const user = await database.collection<{
      _id: ObjectId;
      email: string;
      passwordSalt: string;
      passwordHash: string;
    }>("users").findOne({ email });
    const valid = await verifyPassword(
      body.password,
      user?.passwordSalt ?? dummySalt,
      user?.passwordHash ?? dummyHash,
    );
    if (!user || !valid) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    const token = createAuthToken({ id: user._id.toString(), email: user.email });
    return NextResponse.json({ token, email: user.email });
  } catch (error) {
    console.error("Account sign-in failed", error);
    return NextResponse.json({
      error: "Could not connect to MongoDB Atlas. Check MONGODB_URI and Atlas Network Access for this Render service.",
    }, { status: 503 });
  }
}
