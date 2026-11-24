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

/**
 * How many pages one scan may send.
 *
 * A menu is often several pages, and the reason to scan them together is that
 * the visitor thinks of it as one action. The cap keeps one selection from
 * turning into an unbounded number of model calls.
 */
export const MENU_SCAN_MAX_PAGES = 10

/** "Up to 10 pages at once", printed next to the tile's other limits. */
export const MENU_SCAN_MULTI_PAGE_COPY = `Up to ${MENU_SCAN_MAX_PAGES} pages at once`

export const MENU_SCAN_TOO_MANY_PAGES_MESSAGE = `Only the first ${MENU_SCAN_MAX_PAGES} pages are scanned at once.`

export interface MenuScanRejectedFile {
    name: string
    reason: string
}

export interface MenuScanSelection<T> {
    /** Files to scan, in the order they were chosen. */
    accepted: T[]
    /** Files that will not be scanned, each with the reason to show. */
    rejected: MenuScanRejectedFile[]
}

/**
 * Splits a multi-file selection into what will be scanned and what will not.
 *
 * A bad file in a five-page selection must not discard the other four, so this
 * reports per file rather than rejecting the selection wholesale.
 */
export function partitionMenuScanFiles<T extends MenuScanFileLike & { name?: string }>(
    files: readonly T[],
    maxPages: number = MENU_SCAN_MAX_PAGES
): MenuScanSelection<T> {
    const accepted: T[] = []
    const rejected: MenuScanRejectedFile[] = []

    for (const file of files) {
        const name = file.name || "That file"
        const problem = describeMenuScanFileProblem(file)
        if (problem) {
            rejected.push({ name, reason: problem })
            continue
        }
        if (accepted.length >= maxPages) {
            rejected.push({ name, reason: MENU_SCAN_TOO_MANY_PAGES_MESSAGE })
            continue
        }
        accepted.push(file)
    }

    return { accepted, rejected }
}

/**
 * Collapses case and whitespace so "Iced  Latte" and "iced latte" are one item.
 * Used to merge the pages of a multi-page scan into a single review list.
 */
export function menuScanItemKey(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, " ")
}
