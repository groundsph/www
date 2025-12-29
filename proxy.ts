import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Routes that require authentication (exact match)
const protectedRoutesExact = ["/profile"]
// Routes that require authentication (prefix match)
const protectedRoutesPrefixes = ["/submit"]

export async function proxy(request: NextRequest) {
    // -----------------------------------------------------------------------------
    // 1. Initial Redirects (WWW -> non-WWW, HTTP -> HTTPS)
    // -----------------------------------------------------------------------------
    const url = request.nextUrl.clone();
    const hostname = request.headers.get("host") || "";
    const protocol = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");

    // Redirect WWW to non-WWW
    if (hostname.startsWith("www.")) {
        url.hostname = hostname.replace("www.", "");
        url.protocol = "https";
        return NextResponse.redirect(url, 301);
    }

    // Redirect HTTP to HTTPS (in production, if x-forwarded-proto check passes)
    if (protocol === "http" && hostname !== "localhost") {
        url.protocol = "https";
        return NextResponse.redirect(url, 301);
    }

    // -----------------------------------------------------------------------------
    // 2. Auth & Protected Routes Logic
    // -----------------------------------------------------------------------------
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

    // Refresh session if exists - with error handling
    let user = null
    let profileCompleted = false
    try {
        const {
            data: { user: authUser },
        } = await supabase.auth.getUser()
        user = authUser

        // Check if user has completed their profile setup
        if (user) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("profile_completed")
                .eq("id", user.id)
                .single()
            profileCompleted = !!profile?.profile_completed
        }
    } catch {
        // Error fetching user - treat as not logged in
        user = null
    }

    const { pathname } = request.nextUrl

    // Check if the route is protected
    const isProtectedRoute =
        protectedRoutesExact.includes(pathname) ||
        protectedRoutesPrefixes.some((route) => pathname.startsWith(route))

    // Redirect to auth if accessing protected route without being logged in
    if (isProtectedRoute && !user) {
        const authUrl = request.nextUrl.clone()
        authUrl.pathname = "/auth"
        authUrl.searchParams.set("redirect", pathname)
        return NextResponse.redirect(authUrl)
    }

    // If user is logged in but hasn't completed profile setup, redirect to profile setup
    // (except if already on auth page or callback)
    if (isProtectedRoute && user && !profileCompleted && !pathname.startsWith("/auth")) {
        const authUrl = request.nextUrl.clone()
        authUrl.pathname = "/auth"
        authUrl.searchParams.set("setup", "username")
        authUrl.searchParams.set("redirect", pathname)
        return NextResponse.redirect(authUrl)
    }

    // Redirect away from auth if already logged in AND has completed profile setup
    const isSettingUpUsername = request.nextUrl.searchParams.get("setup") === "username"
    if (pathname.startsWith("/auth") && user && !pathname.includes("/callback")) {
        // Don't redirect if user still needs to complete profile setup
        if (!profileCompleted || isSettingUpUsername) {
            // Stay on auth page for profile setup
            return supabaseResponse
        }
        // User is fully set up, redirect them away from auth
        const redirect = request.nextUrl.searchParams.get("redirect") || "/"
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = redirect
        redirectUrl.searchParams.delete("redirect")
        redirectUrl.searchParams.delete("setup")
        return NextResponse.redirect(redirectUrl)
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
