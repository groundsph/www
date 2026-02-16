import { BlogStatus } from "@/utils/types/blog"

/**
 * Get Tailwind CSS classes for blog status badges
 */
export function getBlogStatusStyle(status: BlogStatus): string {
    switch (status) {
        case "published":
            return "text-green-600 bg-green-100"
        case "pending":
            return "text-orange-600 bg-orange-100"
        case "draft":
            return "text-yellow-600 bg-yellow-100"
        case "archived":
            return "text-gray-600 bg-gray-100"
        default:
            return "text-gray-600 bg-gray-100"
    }
}

/**
 * Get human-readable label for blog status
 */
export function getBlogStatusLabel(status: BlogStatus): string {
    switch (status) {
        case "published":
            return "Published"
        case "pending":
            return "Pending"
        case "draft":
            return "Draft"
        case "archived":
            return "Archived"
        default:
            return status
    }
}
