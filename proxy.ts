import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Routes that require authentication (exact match)
const protectedRoutesExact = ["/profile"]
// Routes that require authentication (prefix match)
const protectedRoutesPrefixes = ["/submit"]

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Refresh session if exists
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl

    // Check if the route is protected
    const isProtectedRoute =
        protectedRoutesExact.includes(pathname) ||
        protectedRoutesPrefixes.some((route) => pathname.startsWith(route))

    // Redirect to auth if accessing protected route without being logged in
    if (isProtectedRoute && !user) {
        const url = request.nextUrl.clone()
        url.pathname = "/auth"
        url.searchParams.set("redirect", pathname)
        return NextResponse.redirect(url)
    }

    // Redirect away from auth if already logged in
    if (pathname.startsWith("/auth") && user && !pathname.includes("/callback")) {
        const redirect = request.nextUrl.searchParams.get("redirect") || "/"
        const url = request.nextUrl.clone()
        url.pathname = redirect
        url.searchParams.delete("redirect")
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
}
