/**
 * Escape LIKE/ILIKE wildcards so user input matches literally.
 *
 * Postgres treats `%` and `_` as wildcards inside a LIKE pattern, so a place
 * name like "50% Cafe" or "San_Jose" would otherwise widen the match.
 */
export function escapeLikePattern(value: string): string {
    return value.replace(/[%_\\]/g, "\\$&")
}
