import { Db, MongoClient } from "mongodb";

type MongoGlobals = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoIndexesPromise?: Promise<void>;
};

const globals = globalThis as MongoGlobals;

function connectionString(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not configured. Add it to .env.local (see .env.example)."
    );
  }
  return uri;
}

export function getDbName(): string {
  return process.env.MONGODB_DB ?? "habit_tracker";
}

async function getClient(): Promise<MongoClient> {
  if (!globals._mongoClientPromise) {
    const client = new MongoClient(connectionString(), {
      serverSelectionTimeoutMS: 5_000,
      ignoreUndefined: true,
    });
    globals._mongoClientPromise = client.connect().catch((error) => {
      globals._mongoClientPromise = undefined;
      throw error;
    });
  }
  return globals._mongoClientPromise;
}

async function createIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("users").createIndex(
      { username: 1 },
      {
        unique: true,
        partialFilterExpression: { username: { $type: "string" } },
      }
    ),
    db.collection("profiles").createIndex({ userId: 1 }),
    db.collection("habits").createIndex({ userId: 1, profileId: 1 }),
    db.collection("pushSubscriptions").createIndex(
      { userId: 1, profileId: 1, endpoint: 1 },
      { unique: true }
    ),
    db.collection("reminderDeliveries").createIndex(
      { profileId: 1, habitId: 1, date: 1 },
      { unique: true }
    ),
    db.collection("reminderDeliveries").createIndex(
      { sentAt: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 60 }
    ),
  ]);
}

export async function getDb(): Promise<Db> {
  const db = (await getClient()).db(getDbName());
  if (!globals._mongoIndexesPromise) {
    globals._mongoIndexesPromise = createIndexes(db).catch((error) => {
      globals._mongoIndexesPromise = undefined;
      throw error;
    });
  }
  await globals._mongoIndexesPromise;
  return db;
}
