export function getAuthConfigurationError() {
  const missing: string[] = [];
  if (!process.env.MONGODB_URI) missing.push("MONGODB_URI");
  if (!process.env.MONGODB_DB_NAME) missing.push("MONGODB_DB_NAME");
  if (!process.env.AUTH_TOKEN_SECRET || Buffer.byteLength(process.env.AUTH_TOKEN_SECRET) < 32) {
    missing.push("AUTH_TOKEN_SECRET (at least 32 bytes)");
  }
  return missing.length ? `Missing Render environment variable(s): ${missing.join(", ")}.` : null;
}
