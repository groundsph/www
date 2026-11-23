/**
 * Grouping for the Menu suggestion queue.
 *
 * A Menu scan becomes one Menu scan batch: every item a scan extracted is an
 * ordinary Menu suggestion sharing a batch id (see `queueMenuScanForReview` in
 * `app/api/actions/menu-ocr.ts`). Reviewing those rows one by one would make
 * approving a forty-item scan forty decisions, so the queue presents a batch as
 * a single entry and the reviewer decides once.
 *
 * Suggestions without a batch id were made one item at a time and are left
 * exactly as they were: individual entries, in their original order, each with
 * its own approve and reject.
 */

export interface MenuSuggestionLike {
    id: string
    cafeId: string
    batchId?: string | null
}

export interface MenuScanBatchGroup<T extends MenuSuggestionLike = MenuSuggestionLike> {
    batchId: string
    cafeId: string
    /** The Cafe's name, when the queue query could resolve it. */
    cafeName: string | null
    /**
     * How many items the scan carries. A batch is pending while any of its rows
     * is pending, so in the queue this is the whole scan.
     */
    itemCount: number
    items: T[]
}

export type MenuSuggestionQueueEntry<T extends MenuSuggestionLike = MenuSuggestionLike> =
    | { kind: "batch"; batch: MenuScanBatchGroup<T> }
    | { kind: "single"; suggestion: T }

/**
 * Turns pending suggestions into queue entries.
 *
 * Batches keep their position at the first row that belongs to them, so a scan
 * does not jump around the queue as its rows are returned. Rows that share no
 * batch id stay individual entries and are passed through untouched.
 */
export function groupMenuSuggestionQueue<
    T extends MenuSuggestionLike & { cafeName?: string | null }
>(suggestions: T[]): MenuSuggestionQueueEntry<T>[] {
    const entries: MenuSuggestionQueueEntry<T>[] = []
    const batches = new Map<string, MenuScanBatchGroup<T>>()

    for (const suggestion of suggestions) {
        const batchId = suggestion.batchId

        if (!batchId) {
            entries.push({ kind: "single", suggestion })
            continue
        }

        const existing = batches.get(batchId)
        if (existing) {
            existing.items.push(suggestion)
            existing.itemCount = existing.items.length
            continue
        }

        const batch: MenuScanBatchGroup<T> = {
            batchId,
            cafeId: suggestion.cafeId,
            cafeName: suggestion.cafeName ?? null,
            itemCount: 1,
            items: [suggestion],
        }
        batches.set(batchId, batch)
        entries.push({ kind: "batch", batch })
    }

    return entries
}
