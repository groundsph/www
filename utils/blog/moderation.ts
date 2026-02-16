import { BlogStatus } from "@/utils/types/blog"

export function resolveBlogStatus(requested: BlogStatus, isAdminOrModerator: boolean): BlogStatus {
    if (isAdminOrModerator) return requested
    return requested === "published" ? "pending" : requested
}
