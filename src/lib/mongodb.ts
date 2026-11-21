import { MongoClient } from "mongodb";

declare global {
  var formlyMongoClient: Promise<MongoClient> | undefined;
}

function getClientPromise() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured.");

  if (!globalThis.formlyMongoClient) {
    const client = new MongoClient(uri, { maxPoolSize: 10 });
    const clientPromise = client.connect().catch((error: unknown) => {
      globalThis.formlyMongoClient = undefined;
      throw error;
    });
    globalThis.formlyMongoClient = clientPromise;
  }
  return globalThis.formlyMongoClient;
}

export async function getMongoClient() {
  const client = await getClientPromise();
  return client;
}

export async function getDatabase() {
  const databaseName = process.env.MONGODB_DB_NAME;
  if (!databaseName) throw new Error("MONGODB_DB_NAME is not configured.");
  const client = await getMongoClient();
  return client.db(databaseName);
}
