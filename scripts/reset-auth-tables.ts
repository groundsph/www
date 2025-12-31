
import { db } from "@/db"
import { sql } from "drizzle-orm"

async function resetAuthTables() {
    console.log("Dropping auth tables...")
    try {
        await db.execute(sql`DROP TABLE IF EXISTS "user" CASCADE`)
        await db.execute(sql`DROP TABLE IF EXISTS "session" CASCADE`)
        await db.execute(sql`DROP TABLE IF EXISTS "account" CASCADE`)
        await db.execute(sql`DROP TABLE IF EXISTS "verification" CASCADE`)
        await db.execute(sql`DROP TABLE IF EXISTS "passkey" CASCADE`)
        console.log("Auth tables dropped successfully.")
    } catch (error) {
        console.error("Error dropping tables:", error)
    } finally {
        process.exit(0)
    }
}

resetAuthTables()
