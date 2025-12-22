import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres((process.env.STORAGE_LAYER_DATABASE_URL as string),{
    max:5,
    idle_timeout:10,
    connect_timeout:10,
    prepare:false
});
export const db = drizzle(client);