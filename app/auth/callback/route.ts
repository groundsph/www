import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get("code")
    const next = searchParams.get("next") ?? "/"

    if (code) {
        const cookieStore = await cookies()

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    },
                },
            }
        )

        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // Check if user needs to set username
            const { data: { user } } = await supabase.auth.getUser()

            if (user && !user.user_metadata?.username) {
                // Redirect to auth page with username mode, preserving the original redirect
                const redirectParam = next !== "/" ? `&redirect=${encodeURIComponent(next)}` : ""
                return NextResponse.redirect(`${origin}/auth?setup=username${redirectParam}`)
            }

            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // Return to auth page with error
    return NextResponse.redirect(`${origin}/auth?error=auth_failed`)
}
