/**
 * Validation result for badge stamp file upload
 */
export interface BadgeStampValidationResult {
    valid: boolean
    error?: string
}

/**
 * Maximum allowed file size for badge stamps (500KB)
 */
const MAX_BADGE_STAMP_SIZE = 500 * 1024 // 500KB

/**
 * Validates a badge stamp file before upload
 * @param file - The file to validate
 * @returns Validation result with optional error message
 */
export function isBadgeStampFileValid(
    file: File
): BadgeStampValidationResult {
    // Check file type (PNG only)
    if (file.type !== "image/png") {
        return { valid: false, error: "Only PNG files are allowed" }
    }

    // Check file size (max 500KB)
    if (file.size > MAX_BADGE_STAMP_SIZE) {
        return { valid: false, error: "File size must be less than 500KB" }
    }

    return { valid: true }
}
