import { createBrowserClient } from "@supabase/ssr";


export function createLocalClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            // No need to pass cookies, the browser will handle it
        }
    )
}