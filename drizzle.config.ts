import {defineConfig} from "drizzle-kit"

export default defineConfig({
    schema: "./src/db/schema.ts",
    dialect: "postgresql",
    dbCredentials:{
        url: process.env.STORAGE_LAYER_DATABASE_URL as string
    }
})