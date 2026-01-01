import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/db"
import { session, user, profiles } from "@/db/schema"
import { eq } from "drizzle-orm"

// Routes that require authentication (exact match)
const protectedRoutesExact = ["/profile", "/profile/settings", "/profile/claim-supporter"]
// Routes that require authentication (prefix match)
const protectedRoutesPrefixes = ["/submit", "/owner", "/manage", "/writer", "/profile/collections"]
// Routes to skip auth checks entirely (performance optimization)
const skipAuthPrefixes = ["/api/", "/_next/", "/auth/callback"]

/**
 * Helper to check if a route requires authentication
 */
function isProtectedRoute(pathname: string): boolean {
    return (
        protectedRoutesExact.includes(pathname) ||
        protectedRoutesPrefixes.some((route) => pathname.startsWith(route))
    )
}

/**
 * Helper to check if auth checks should be skipped entirely
 */
function shouldSkipAuth(pathname: string): boolean {
    return skipAuthPrefixes.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Get authenticated user from session token
 */
async function getAuthUser(token: string) {
    try {
        // Split token to handle signed cookies (token.signature format)
        const tokenValue = token.split(".")[0]

        const sessionResult = await db
            .select({
                user: user,
                session: session,
            })
            .from(session)
            .innerJoin(user, eq(session.userId, user.id))
            .where(eq(session.token, tokenValue))
            .limit(1)

        const validSession = sessionResult[0]
        if (validSession && new Date(validSession.session.expiresAt) > new Date()) {
            return validSession.user
        }
        return null
    } catch (error) {
        console.error("Middleware auth check failed:", error)
        return null
    }
}

/**
 * Check if user has completed profile setup
 */
async function hasCompletedProfile(userId: string): Promise<boolean> {
    try {
        const profileResult = await db
            .select({ profileCompleted: profiles.profileCompleted })
            .from(profiles)
            .where(eq(profiles.id, userId))
            .limit(1)

        return !!profileResult[0]?.profileCompleted
    } catch {
        return false
    }
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Skip auth checks for API routes and static assets (performance)
    if (shouldSkipAuth(pathname)) {
        return NextResponse.next()
    }

    const isProtected = isProtectedRoute(pathname)
    const isAuthPage = pathname.startsWith("/auth")

    // Early exit: If route is not protected and not auth page, skip auth
    if (!isProtected && !isAuthPage) {
        return NextResponse.next()
    }

    // Get session token
    const token =
        request.cookies.get("better-auth.session_token")?.value ||
        request.cookies.get("__Secure-better-auth.session_token")?.value

    // No token = not authenticated
    if (!token) {
        if (isProtected) {
            const authUrl = request.nextUrl.clone()
            authUrl.pathname = "/auth"
            authUrl.searchParams.set("redirect", pathname)
            return NextResponse.redirect(authUrl)
        }
        return NextResponse.next()
    }

    // Validate session
    const authUser = await getAuthUser(token)

    if (!authUser) {
        if (isProtected) {
            const authUrl = request.nextUrl.clone()
            authUrl.pathname = "/auth"
            authUrl.searchParams.set("redirect", pathname)
            return NextResponse.redirect(authUrl)
        }
        return NextResponse.next()
    }

    // Check profile completion (only for protected routes)
    const profileCompleted = isProtected ? await hasCompletedProfile(authUser.id) : true

    // Protected route + incomplete profile = redirect to profile setup
    if (isProtected && !profileCompleted) {
        const authUrl = request.nextUrl.clone()
        authUrl.pathname = "/auth"
        authUrl.searchParams.set("setup", "username")
        authUrl.searchParams.set("redirect", pathname)
        return NextResponse.redirect(authUrl)
    }

    // Auth page + authenticated + profile complete = redirect away
    if (isAuthPage && !pathname.includes("/callback")) {
        const isSettingUpUsername = request.nextUrl.searchParams.get("setup") === "username"

        if (!profileCompleted || isSettingUpUsername) {
            return NextResponse.next()
        }

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
         * Match all request paths except for:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
}
