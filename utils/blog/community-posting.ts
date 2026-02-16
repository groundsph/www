import type { BlogCategory } from "@/utils/types/blog"

type UserRole = "user" | "writer" | "admin" | "moderator"

const WRITER_ALLOWED_CATEGORIES: BlogCategory[] = ["news", "guides", "community"]

export function canSubmitBlogPost(input: {
    role: UserRole | null
    category: BlogCategory
    hasCafeOwnership: boolean
}) {
    // Admin and moderator can submit to any category
    if (input.role === "admin" || input.role === "moderator") {
        return { allowed: true }
    }

    // Cafe owners can submit to any category (regardless of role)
    if (input.hasCafeOwnership) {
        return { allowed: true }
    }

    // Writers can submit to allowed categories only
    if (input.role === "writer") {
        const allowed = WRITER_ALLOWED_CATEGORIES.includes(input.category)
        return { allowed }
    }

    // Regular users can only submit community posts
    if (input.role === "user") {
        const allowed = input.category === "community"
        return { allowed }
    }

    // Null role without cafe ownership - cannot submit
    return { allowed: false }
}
