
import { db } from "@/db"
import { sql } from "drizzle-orm"

async function setupProfileDeleteTrigger() {
    console.log("Setting up profile deletion trigger...")

    try {
        // 1. Create the function
        await db.execute(sql`
            CREATE OR REPLACE FUNCTION public.handle_user_deleted()
            RETURNS TRIGGER AS $$
            BEGIN
                DELETE FROM public.profiles WHERE id = OLD.id;
                RETURN OLD;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        `)

        // 2. Create the trigger
        await db.execute(sql`
            DROP TRIGGER IF EXISTS on_auth_user_deleted ON "user";
            CREATE TRIGGER on_auth_user_deleted
            AFTER DELETE ON "user"
            FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();
        `)

        console.log("Trigger 'on_auth_user_deleted' created successfully.")

        process.exit(0)
    } catch (error) {
        console.error("Error setting up trigger:", error)
        process.exit(1)
    }
}

setupProfileDeleteTrigger()
