import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres((process.env.STORAGE_LAYER_DATABASE_URL as string));
export const db = drizzle(client);