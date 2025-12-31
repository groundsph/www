import { neon } from "@neondatabase/serverless"
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "@/db/schema"

// Lazy initialization to prevent connection at build time
let _db: NeonHttpDatabase<typeof schema> | null = null

function getDb(): NeonHttpDatabase<typeof schema> {
    if (!_db) {
        const sql = neon(process.env.DATABASE_URL!)
        _db = drizzle(sql, { schema })
    }
    return _db
}

// Proxy to make db access lazy - only connects when first queried at runtime
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
    get(_, prop) {
        return (getDb() as unknown as Record<string, unknown>)[prop as string]
    }
})

export type Database = typeof db
