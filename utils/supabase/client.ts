import { createBrowserClient } from "@supabase/ssr";
import { Database } from "../types/database.types";


export function createLocalClient() {
    return createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            // No need to pass cookies, the browser will handle it
        }
    )
}