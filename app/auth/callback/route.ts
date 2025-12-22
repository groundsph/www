import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get("code")
    const next = searchParams.get("next") ?? "/"

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // Check if user needs to set username
            const { data: { user } } = await supabase.auth.getUser()

            if (user && !user.user_metadata?.username) {
                // Redirect to auth page with username mode
                return NextResponse.redirect(`${origin}/auth?setup=username`)
            }

            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // Return to auth page with error
    return NextResponse.redirect(`${origin}/auth?error=auth_failed`)
}
