import { NextResponse } from "next/server";
import { createAuthToken, hashPassword, normalizeEmail } from "@/lib/auth";
import { getAuthConfigurationError } from "@/lib/auth-config";
import { getDatabase } from "@/lib/mongodb";

function isEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let body: {
    email?: unknown;
    password?: unknown;
    fullName?: unknown;
    phoneNumber?: unknown;
    gender?: unknown;
    country?: unknown;
    region?: unknown;
    city?: unknown;
    streetAddress?: unknown;
    dateOfBirth?: unknown;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Enter an email and password." }, { status: 400 });
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
  const country = typeof body.country === "string" ? body.country.trim() : "";
  const region = typeof body.region === "string" ? body.region.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const streetAddress = typeof body.streetAddress === "string" ? body.streetAddress.trim() : "";
  const gender = body.gender === "" || body.gender === undefined ? null : body.gender;
  const dateOfBirth = body.dateOfBirth === "" || body.dateOfBirth === undefined
    ? null
    : body.dateOfBirth;
  const phoneDigits = phoneNumber.replace(/\D/g, "");
  const genderOptions = ["Female", "Male", "Non-binary", "Other", "Prefer not to say"];
  const validDateOfBirth = typeof dateOfBirth === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) &&
    !Number.isNaN(new Date(`${dateOfBirth}T00:00:00.000Z`).getTime()) &&
    new Date(`${dateOfBirth}T00:00:00.000Z`).toISOString().slice(0, 10) === dateOfBirth &&
    dateOfBirth <= new Date().toISOString().slice(0, 10);
  if (fullName.length < 2 || fullName.length > 120 ||
      phoneNumber.length > 25 || !/^\+?[0-9][0-9\s().-]{5,23}$/.test(phoneNumber) ||
      phoneDigits.length < 7 || phoneDigits.length > 15 ||
      country.length < 2 || country.length > 100 ||
      region.length < 2 || region.length > 100 ||
      city.length < 2 || city.length > 100 ||
      streetAddress.length < 2 || streetAddress.length > 200 ||
      (gender !== null && (typeof gender !== "string" || !genderOptions.includes(gender))) ||
      (dateOfBirth !== null && !validDateOfBirth)) {
    return NextResponse.json({
      error: "Enter your name, phone number, country, region, city, and street address. Gender and date of birth are optional.",
    }, { status: 400 });
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
      fullName: string;
      phoneNumber: string;
      gender: string | null;
      country: string;
      region: string;
      city: string;
      streetAddress: string;
      dateOfBirth: string | null;
      createdAt: Date;
    }>("users");
    await users.createIndex({ email: 1 }, { unique: true });

    const credentials = await hashPassword(body.password);
    const result = await users.insertOne({
      email,
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
      fullName,
      phoneNumber,
      gender,
      country,
      region,
      city,
      streetAddress,
      dateOfBirth,
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
