import { createBrowserClient } from "@supabase/ssr";
import { Database } from "../types/database.types";
import { SupabaseClient } from "@supabase/supabase-js";

// Singleton instance to ensure consistent auth state across all components
let supabaseClient: SupabaseClient<Database> | null = null;

export function createLocalClient() {
    if (supabaseClient) {
        return supabaseClient;
    }

    supabaseClient = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            // Enable cross-tab auth state sync
            auth: {
                storageKey: 'grounds-auth',
                detectSessionInUrl: true,
                flowType: 'pkce',
            },
        }
    );

    return supabaseClient;
}