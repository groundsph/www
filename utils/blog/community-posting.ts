import type { BlogCategory } from "@/utils/types/blog"

export function canSubmitCommunityBlog(input: {
    role: "user" | "writer" | "admin" | "moderator" | string | null
    category: BlogCategory
    hasCafeOwnership: boolean
}) {
    if (input.role === "admin" || input.role === "moderator") {
        return { allowed: true, requiresCafe: false }
    }

    if (input.role === "writer") {
        return { allowed: true, requiresCafe: false }
    }

    if (input.role === "user" && input.category === "community") {
        return { allowed: true, requiresCafe: false }
    }

    if (input.hasCafeOwnership) {
        return { allowed: true, requiresCafe: true }
    }

    return { allowed: false, requiresCafe: true }
}
