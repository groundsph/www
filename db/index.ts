import { Pool } from "pg"
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres"
import * as schema from "@/db/schema"

// Lazy initialization to prevent connection at build time
let _db: NodePgDatabase<typeof schema> | null = null
let _pool: Pool | null = null

function getDb(): NodePgDatabase<typeof schema> {
    if (!_db) {
        _pool = new Pool({
            connectionString: process.env.DATABASE_URL!,
        })
        _db = drizzle(_pool, { schema })
    }
    return _db
}

// Proxy to make db access lazy - only connects when first queried at runtime
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
    get(_, prop) {
        return (getDb() as unknown as Record<string, unknown>)[prop as string]
    }
})

export type Database = typeof db
