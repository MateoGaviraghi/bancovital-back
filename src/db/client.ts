import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let cachedClient: postgres.Sql | undefined;
let cachedDb: Db | undefined;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Refusing to construct a Drizzle client.');
  }
  return url;
}

export function getDb(): Db {
  if (cachedDb) return cachedDb;
  cachedClient = postgres(getDatabaseUrl(), {
    max: 10,
    idle_timeout: 30,
    prepare: false,
  });
  cachedDb = drizzle(cachedClient, { schema });
  return cachedDb;
}

export async function closeDb(): Promise<void> {
  if (cachedClient) {
    await cachedClient.end({ timeout: 5 });
    cachedClient = undefined;
    cachedDb = undefined;
  }
}
