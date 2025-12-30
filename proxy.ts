import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/db"
import { session, user, profiles } from "@/db/schema"
import { eq } from "drizzle-orm"

// Routes that require authentication (exact match)
const protectedRoutesExact = ["/profile"]
// Routes that require authentication (prefix match)
const protectedRoutesPrefixes = ["/submit"]

export async function proxy(request: NextRequest) {
    const token = request.cookies.get("better-auth.session_token")?.value || request.cookies.get("__Secure-better-auth.session_token")?.value

    let authUser = null
    let profileCompleted = false

    if (token) {
        try {
            // Split token to handle signed/prefixed cookies (token.signature)
            // The DB stores the raw token, but the cookie may contain a signature suffix
            const tokenValue = token.split(".")[0]

            // Query session and user
            const sessionResult = await db.select({
                user: user,
                session: session
            })
                .from(session)
                .innerJoin(user, eq(session.userId, user.id))
                .where(eq(session.token, tokenValue))
                .limit(1)

            const validSession = sessionResult[0]
            if (validSession && new Date(validSession.session.expiresAt) > new Date()) {
                authUser = validSession.user

                // Check if user has completed their profile setup
                // profiles.id is UUID, authUser.id is string (containing UUID). Drizzle handles string->uuid
                const profileResult = await db.select({ profileCompleted: profiles.profileCompleted })
                    .from(profiles)
                    .where(eq(profiles.id, authUser.id))
                    .limit(1)

                profileCompleted = !!profileResult[0]?.profileCompleted
            }
        } catch (error) {
            console.error("Middleware auth check failed:", error)
        }
    }

    const { pathname } = request.nextUrl

    // Check if the route is protected
    const isProtectedRoute =
        protectedRoutesExact.includes(pathname) ||
        protectedRoutesPrefixes.some((route) => pathname.startsWith(route))

    // Redirect to auth if accessing protected route without being logged in
    if (isProtectedRoute && !authUser) {
        const authUrl = request.nextUrl.clone()
        authUrl.pathname = "/auth"
        authUrl.searchParams.set("redirect", pathname)
        return NextResponse.redirect(authUrl)
    }

    // If user is logged in but hasn't completed profile setup, redirect to profile setup
    // (except if already on auth page or callback)
    if (isProtectedRoute && authUser && !profileCompleted && !pathname.startsWith("/auth")) {
        const authUrl = request.nextUrl.clone()
        authUrl.pathname = "/auth"
        authUrl.searchParams.set("setup", "username")
        authUrl.searchParams.set("redirect", pathname)
        return NextResponse.redirect(authUrl)
    }

    // Redirect away from auth if already logged in AND has completed profile setup
    const isSettingUpUsername = request.nextUrl.searchParams.get("setup") === "username"
    if (pathname.startsWith("/auth") && authUser && !pathname.includes("/callback")) {
        // Don't redirect if user still needs to complete profile setup
        if (!profileCompleted || isSettingUpUsername) {
            // Stay on auth page for profile setup
            return NextResponse.next()
        }
        // User is fully set up, redirect them away from auth
        const redirect = request.nextUrl.searchParams.get("redirect") || "/"
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = redirect
        redirectUrl.searchParams.delete("redirect")
        redirectUrl.searchParams.delete("setup")
        return NextResponse.redirect(redirectUrl)
    }

    return NextResponse.next()
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
