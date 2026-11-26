import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

type StoredProfile = {
  email: string;
  fullName?: string;
  phoneNumber?: string;
  gender?: string | null;
  country?: string;
  region?: string;
  city?: string;
  streetAddress?: string;
  dateOfBirth?: string | null;
};

export async function GET(request: Request) {
  const token = getBearerToken(request);
  const user = token ? verifyAuthToken(token) : null;
  if (!user || !ObjectId.isValid(user.id)) {
    return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  }

  try {
    const database = await getDatabase();
    const profile = await database.collection<StoredProfile>("users").findOne(
      { _id: new ObjectId(user.id) },
      {
        projection: {
          _id: 0,
          email: 1,
          fullName: 1,
          phoneNumber: 1,
          gender: 1,
          country: 1,
          region: 1,
          city: 1,
          streetAddress: 1,
          dateOfBirth: 1,
        },
      },
    );
    if (!profile) {
      return NextResponse.json({ error: "Could not find your account profile." }, { status: 404 });
    }

    return NextResponse.json({
      profile: {
        email: profile.email,
        fullName: profile.fullName ?? null,
        phoneNumber: profile.phoneNumber ?? null,
        gender: profile.gender ?? null,
        country: profile.country ?? null,
        region: profile.region ?? null,
        city: profile.city ?? null,
        streetAddress: profile.streetAddress ?? null,
        dateOfBirth: profile.dateOfBirth ?? null,
      },
    });
  } catch (error) {
    console.error("Account profile lookup failed", error);
    return NextResponse.json({ error: "Could not load your account profile." }, { status: 503 });
  }
}
