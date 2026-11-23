/**
 * Menu scan photo limits — the ones the scan tile states.
 *
 * One list drives the tile copy, the file inputs' `accept` attribute and the
 * client-side check, so what the tile promises and what the app enforces are
 * the same thing and cannot drift apart. The OCR route deliberately keeps a
 * wider accepted set; being tolerant server-side costs nothing.
 */

export const MENU_SCAN_ACCEPTED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const

export type MenuScanMimeType = (typeof MENU_SCAN_ACCEPTED_MIME_TYPES)[number]

/** The accepted formats as they are printed on the tile. */
export const MENU_SCAN_ACCEPTED_FORMAT_LABELS = "JPEG, PNG, WebP"

/** The size limit as it is printed on the tile. */
export const MENU_SCAN_MAX_FILE_MB = 10

export const MENU_SCAN_MAX_FILE_BYTES = MENU_SCAN_MAX_FILE_MB * 1024 * 1024

/** The tile's stated limits: "JPEG, PNG, WebP up to 10 MB". */
export const MENU_SCAN_LIMITS_COPY = `${MENU_SCAN_ACCEPTED_FORMAT_LABELS} up to ${MENU_SCAN_MAX_FILE_MB} MB`

/** What the hidden file inputs advertise to the OS picker. */
export const MENU_SCAN_ACCEPT_ATTRIBUTE = MENU_SCAN_ACCEPTED_MIME_TYPES.join(",")

/**
 * The compression budget the scan path works to.
 *
 * A photo of a dense drinks Menu is small type and tight columns with a price
 * beside every line, so a 1024 px long edge erases exactly the detail the
 * extraction depends on. 1600 px keeps that type readable, and a 1.5 MB target
 * keeps the upload — and the model's image tokens — bounded.
 *
 * Named and exported rather than written at the call site so the number is
 * assertable on its own, and so changing it is one edit in one place.
 */
export const MENU_SCAN_COMPRESSION_MAX_LONG_EDGE_PX = 1600

export const MENU_SCAN_COMPRESSION_TARGET_MB = 1.5

export const MENU_SCAN_UNSUPPORTED_FORMAT_MESSAGE =
    "That file is not a JPEG, PNG, or WebP image. Choose one of those formats."

export const MENU_SCAN_TOO_LARGE_MESSAGE = `That photo is larger than ${MENU_SCAN_MAX_FILE_MB} MB. Choose a smaller one.`

export interface MenuScanFileLike {
    type: string
    size: number
}

/**
 * A readable reason the chosen file cannot be scanned, or null when it can.
 *
 * Runs on the file the visitor picked, before compression, so a bad choice
 * costs them a message instead of a wait and a failed scan.
 */
export function describeMenuScanFileProblem(file: MenuScanFileLike): string | null {
    if (!MENU_SCAN_ACCEPTED_MIME_TYPES.includes(file.type as MenuScanMimeType)) {
        return MENU_SCAN_UNSUPPORTED_FORMAT_MESSAGE
    }
    if (file.size > MENU_SCAN_MAX_FILE_BYTES) {
        return MENU_SCAN_TOO_LARGE_MESSAGE
    }
    return null
}
