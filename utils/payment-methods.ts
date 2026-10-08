/**
 * Payment method taxonomy for cafe listings.
 *
 * Storage is a comma-separated string on `cafes.payment_methods` — there is no
 * enum, no join table, and nothing that validates the value at the database
 * level. That makes this module the single source of truth for three things:
 *
 *  1. the canonical token list ({@link PAYMENT_METHODS})
 *  2. how a token is displayed ({@link PAYMENT_METHOD_LABELS})
 *  3. how legacy and free-text values fold into canonical tokens
 *     ({@link PAYMENT_METHOD_ALIASES} + {@link normalizePaymentMethods})
 *
 * Every write path runs through the normalizer, so the vocabulary cannot drift
 * again the way `BPI` did.
 *
 * This module is deliberately dependency-free: it is imported by server
 * actions as well as client components, so it must not pull in the React hooks
 * barrel for a title-casing helper.
 */

/**
 * Canonical payment method tokens, in display order.
 *
 * `card` and `qr_ph` are deliberately coarse. `card` covers credit, debit, and
 * any contactless wallet riding the same terminal; `qr_ph` covers both QR Ph
 * scanning and account-to-account transfers, which are two rails behind one
 * customer action.
 */
export const PAYMENT_METHODS = [
    "cash",
    "card",
    "gcash",
    "maya",
    "qr_ph",
    "google_pay",
    "apple_pay",
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number];

/**
 * Display labels keyed by canonical token.
 *
 * Raw tokens are `lower_snake_case`, which reads badly on its own — the
 * fallback title-casing renders `gcash` as "Gcash" and `qrph` as "Qrph". Every
 * display surface renders through this map instead.
 */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    cash: "Cash",
    card: "Credit / Debit Card",
    gcash: "GCash",
    maya: "Maya",
    qr_ph: "QR Ph / Bank Transfer",
    google_pay: "Google Pay",
    apple_pay: "Apple Pay",
};

/**
 * Legacy and free-text values folded into canonical tokens. Keys are matched
 * after lowercasing and trimming, so `BPI`, `bpi`, and `" BPI "` all resolve.
 *
 * - `credit_card` / `debit_card` — same terminal, same tap. They appeared
 *   together in every multi-card row in production.
 * - `qrph` / `bank_transfer` — two rails, one customer action: pay from a bank
 *   or e-wallet account instead of cash or card.
 * - `bpi` — free text that entered through the custom input before the
 *   normalizer existed.
 */
export const PAYMENT_METHOD_ALIASES: Record<string, string> = {
    credit_card: "card",
    debit_card: "card",
    qrph: "qr_ph",
    bank_transfer: "qr_ph",
    bpi: "qr_ph",
};

/**
 * Reduce a single raw entry to a canonical token.
 *
 * Lowercases, converts internal whitespace to underscores, strips punctuation,
 * then resolves aliases. Unknown values pass through rather than being
 * dropped — an owner's custom value is never silently discarded.
 *
 * @example normalizePaymentMethod("Credit Card") => "card"
 * @example normalizePaymentMethod("  Bank Transfer ") => "qr_ph"
 * @example normalizePaymentMethod("Google Pay") => "google_pay"
 * @example normalizePaymentMethod("Venmo") => "venmo"
 */
export function normalizePaymentMethod(raw: string): string {
    const token = raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")

    if (!token) return ""
    return PAYMENT_METHOD_ALIASES[token] ?? token
}

/**
 * Normalize a stored comma-separated value into canonical tokens.
 *
 * Trims, drops empties, resolves aliases, and dedupes while preserving
 * first-occurrence order — so `"credit_card, debit_card"` collapses to a single
 * `card` instead of duplicating it.
 *
 * This is idempotent: normalizing an already-normalized value is a no-op. The
 * production backfill relies on that property, and reuses this exact function
 * so the migration and the app can never disagree.
 *
 * @example normalizePaymentMethods("cash, credit_card, debit_card, gcash")
 *          => ["cash", "card", "gcash"]
 */
export function normalizePaymentMethods(
    input: string | null | undefined
): string[] {
    if (!input) return []

    const seen = new Set<string>()
    const tokens: string[] = []

    for (const part of input.split(",")) {
        const token = normalizePaymentMethod(part)
        if (token && !seen.has(token)) {
            seen.add(token)
            tokens.push(token)
        }
    }

    return tokens
}

/**
 * Normalize and re-serialize for storage in `cafes.payment_methods`.
 *
 * Returns `""` for empty input so callers can persist a consistent empty value
 * rather than `null` vs `""` inconsistently.
 */
export function serializePaymentMethods(
    input: string | null | undefined
): string {
    return normalizePaymentMethods(input).join(", ")
}

/**
 * Add comma-separated free-text entries to a stored value.
 *
 * Used by the custom-payment input, where an owner may type anything from
 * `"GCash"` to `"bank transfer"` to `"Venmo"`. Each entry is normalized, so
 * natural spellings land on canonical tokens rather than creating new ones.
 *
 * @example addPaymentMethods("cash", "Credit Card") => "cash, card"
 * @example addPaymentMethods("cash", "Apple Pay, Venmo") => "cash, apple_pay, venmo"
 */
export function addPaymentMethods(
    current: string | null | undefined,
    input: string
): string {
    return serializePaymentMethods(
        [...normalizePaymentMethods(current), ...input.split(",")].join(",")
    )
}

/**
 * Toggle a single canonical method on a stored value.
 *
 * Operates on the normalized token set rather than the raw string, so a row
 * still holding `credit_card, debit_card` deselects as one `card` rather than
 * leaving half of a merged pair behind.
 *
 * @example togglePaymentMethod("cash, credit_card, debit_card", "card") => "cash"
 */
export function togglePaymentMethod(
    current: string | null | undefined,
    method: string
): string {
    const tokens = normalizePaymentMethods(current)
    const next = tokens.includes(method)
        ? tokens.filter((token) => token !== method)
        : [...tokens, method]

    return next.join(", ")
}

/**
 * Tokens offered as discovery filters on the cafe list.
 *
 * Deliberately narrower than {@link PAYMENT_METHODS}:
 *
 * - `cash` is on 104 of the 110 cafes that record a payment method, so it
 *   filters almost nothing.
 * - `maya` stays a valid stored value and still renders on cafe pages, but it is
 *   not offered as a filter chip. Most owners record the brand their QR code
 *   actually works with, and `qr_ph` already carries the interoperable case.
 */
export const FILTERABLE_PAYMENT_METHODS = [
    "card",
    "gcash",
    "qr_ph",
    "google_pay",
    "apple_pay",
] as const;

export type FilterablePaymentMethod =
    typeof FILTERABLE_PAYMENT_METHODS[number];

/**
 * Validate a client-supplied payment filter against the filterable list.
 *
 * Server actions receive filters from the browser, so unknown or malformed
 * entries are dropped here rather than reaching the query. Accepts a single
 * string or an array, so a one-value filter works either way, and normalizes
 * first so `"QR Ph"` resolves to `qr_ph`.
 *
 * @example parsePaymentMethodFilter(["gcash", "GCash", "venmo"])
 *          => ["gcash"]
 * @example parsePaymentMethodFilter("qr_ph") => ["qr_ph"]
 */
export function parsePaymentMethodFilter(value: unknown): string[] {
    const raw = Array.isArray(value)
        ? value
        : value === null || value === undefined
          ? []
          : [value];

    const allowed = FILTERABLE_PAYMENT_METHODS as readonly string[];
    const seen = new Set<string>();
    const tokens: string[] = [];

    for (const entry of raw) {
        if (typeof entry !== "string") continue;

        const token = normalizePaymentMethod(entry);
        if (token && allowed.includes(token) && !seen.has(token)) {
            seen.add(token);
            tokens.push(token);
        }
    }

    return tokens;
}

/**
 * Normalize a stored value into display labels for rendering.
 *
 * Legacy tokens resolve through the alias map first, so a row still holding
 * `credit_card, debit_card` renders as a single "Credit / Debit Card" even
 * before the production backfill runs. Unknown custom values fall back to
 * title-cased text.
 *
 * @example formatPaymentMethods("bank_transfer, cash")
 *          => ["QR Ph / Bank Transfer", "Cash"]
 */
export function formatPaymentMethods(
    input: string | null | undefined
): string[] {
    return normalizePaymentMethods(input).map(
        (token) =>
            PAYMENT_METHOD_LABELS[token] ??
            token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    )
}
