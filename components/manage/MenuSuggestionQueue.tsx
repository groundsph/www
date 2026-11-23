"use client"

import { useState } from "react"
import { Check, ChevronDown, ChevronUp, Store, UtensilsCrossed, X } from "lucide-react"
import EmptyState from "@/components/ui/EmptyState"
import {
    approveMenuItemSuggestion,
    approveMenuSuggestionBatch,
    rejectMenuItemSuggestion,
    rejectMenuSuggestionBatch,
    type PendingMenuItemSuggestion,
} from "@/app/api/actions/menu-suggestions"
import {
    groupMenuSuggestionQueue,
    type MenuScanBatchGroup,
} from "@/utils/menu/suggestion-batches"

/**
 * The Menu suggestion queue as a reviewer sees it.
 *
 * Two kinds of entry share one list. A suggestion made one item at a time is an
 * individual row with its own approve and reject, unchanged. A Menu scan batch is
 * one entry naming the Cafe and the number of items the scan carries, with a
 * single approve or reject for the whole scan.
 *
 * The queue only ever renders pending suggestions; the parent drops an entry once
 * it has been reviewed, so the list reflects the outcome without a reload and
 * falls back to the same empty state it always had.
 */

interface MenuSuggestionQueueProps {
    suggestions: PendingMenuItemSuggestion[]
    /** Called with the ids of suggestions the queue no longer needs to show. */
    onProcessed: (suggestionIds: string[]) => void
}

function SingleSuggestionCard({
    suggestion,
    isExpanded,
    onToggleExpanded,
    onProcessed,
}: {
    suggestion: PendingMenuItemSuggestion
    isExpanded: boolean
    onToggleExpanded: () => void
    onProcessed: (suggestionIds: string[]) => void
}) {
    const [isProcessing, setIsProcessing] = useState(false)
    const data = suggestion.suggestedData

    const handleApprove = async () => {
        setIsProcessing(true)
        const result = await approveMenuItemSuggestion(suggestion.id)
        if (result.success) {
            onProcessed([suggestion.id])
        } else {
            alert(result.error || "Failed to approve menu suggestion")
        }
        setIsProcessing(false)
    }

    const handleReject = async () => {
        if (!confirm("Are you sure you want to reject this menu item suggestion?")) {
            return
        }
        setIsProcessing(true)
        const result = await rejectMenuItemSuggestion(suggestion.id)
        if (result.success) {
            onProcessed([suggestion.id])
        } else {
            alert(result.error || "Failed to reject menu suggestion")
        }
        setIsProcessing(false)
    }

    return (
        <div className="bg-background shadow-sm border border-tertiary/50 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            {/* Header */}
            <div
                className="p-3 sm:p-4 cursor-pointer hover:bg-tertiary/10 transition flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
                onClick={onToggleExpanded}
            >
                {/* Type Badge */}
                <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    suggestion.type === 'add'
                        ? 'bg-green-500/20 text-green-600'
                        : suggestion.type === 'edit'
                          ? 'bg-amber-500/20 text-amber-600'
                          : 'bg-red-500/20 text-red-600'
                }`}>
                    <UtensilsCrossed className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">
                            {data.name || "Unnamed Item"}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                            suggestion.type === 'add'
                                ? 'bg-green-100 text-green-700'
                                : suggestion.type === 'edit'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                        }`}>
                            {suggestion.type === 'add' && 'Add'}
                            {suggestion.type === 'edit' && 'Edit'}
                            {suggestion.type === 'remove' && 'Remove'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-tertiary/50 text-text/70 rounded-full">
                            {data.category}
                        </span>
                    </div>
                    <p className="text-sm text-text/60 truncate">
                        {data.price !== undefined && (
                            <span className="font-medium text-text/80">
                                ₱{data.price.toFixed(2)}
                            </span>
                        )}
                        {data.description && (
                            <span className="ml-2">{data.description.slice(0, 60)}...</span>
                        )}
                    </p>
                    <p className="text-xs text-text/40">
                        Suggested for cafe ID: {suggestion.cafeId.slice(0, 8)}...
                        {" "}•{" "}
                        {suggestion.createdAt ? new Date(suggestion.createdAt).toLocaleDateString() : "Unknown date"}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            handleApprove()
                        }}
                        disabled={isProcessing}
                        className="p-2 bg-green-500/20 text-green-600 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50"
                        title="Approve"
                    >
                        <Check className="w-5 h-5" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            handleReject()
                        }}
                        disabled={isProcessing}
                        className="p-2 bg-red-500/20 text-red-600 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50"
                        title="Reject"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-text opacity-40" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-text opacity-40" />
                    )}
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="border-t border-tertiary/50 p-4 space-y-4 bg-tertiary/10">
                    {/* Item Details */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                            <h4 className="text-xs font-medium text-text/40 uppercase mb-1">
                                Name
                            </h4>
                            <p className="text-sm text-text/80">{data.name}</p>
                        </div>
                        <div>
                            <h4 className="text-xs font-medium text-text/40 uppercase mb-1">
                                Category
                            </h4>
                            <p className="text-sm text-text/80">{data.category}</p>
                        </div>
                        <div>
                            <h4 className="text-xs font-medium text-text/40 uppercase mb-1">
                                Price
                            </h4>
                            <p className="text-sm text-text/80">₱{data.price?.toFixed(2)}</p>
                        </div>
                        {data.calories !== undefined && data.calories !== null && (
                            <div>
                                <h4 className="text-xs font-medium text-text/40 uppercase mb-1">
                                    Calories
                                </h4>
                                <p className="text-sm text-text/80">{data.calories} kcal</p>
                            </div>
                        )}
                        {data.is_food !== undefined && (
                            <div>
                                <h4 className="text-xs font-medium text-text/40 uppercase mb-1">
                                    Type
                                </h4>
                                <p className="text-sm text-text/80">
                                    {data.is_food ? 'Food' : 'Beverage'}
                                </p>
                            </div>
                        )}
                        {(data.is_hot || data.is_cold) && (
                            <div>
                                <h4 className="text-xs font-medium text-text/40 uppercase mb-1">
                                    Temperature
                                </h4>
                                <p className="text-sm text-text/80">
                                    {[
                                        data.is_hot && 'Hot',
                                        data.is_cold && 'Cold'
                                    ].filter(Boolean).join(' / ')}
                                </p>
                            </div>
                        )}
                        {(data.is_vegan || data.is_vegetarian) && (
                            <div>
                                <h4 className="text-xs font-medium text-text/40 uppercase mb-1">
                                    Dietary
                                </h4>
                                <p className="text-sm text-text/80">
                                    {[
                                        data.is_vegan && 'Vegan',
                                        data.is_vegetarian && 'Vegetarian'
                                    ].filter(Boolean).join(' / ')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    {data.description && (
                        <div>
                            <h4 className="text-xs font-medium text-text/40 uppercase mb-1">
                                Description
                            </h4>
                            <p className="text-sm text-text/80 bg-background p-2 rounded-lg">
                                {data.description}
                            </p>
                        </div>
                    )}

                    {/* Size Options */}
                    {data.size_options && data.size_options.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-text/40 uppercase mb-2">
                                Size Options
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {data.size_options.map((size, idx) => (
                                    <span
                                        key={idx}
                                        className="px-2 py-1 bg-background rounded-lg text-sm text-text/80"
                                    >
                                        {size.label}: ₱{size.price.toFixed(2)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Target Item for Edit/Remove */}
                    {suggestion.targetItemId && (
                        <div>
                            <h4 className="text-xs font-medium text-text/40 uppercase mb-1">
                                Target Item ID
                            </h4>
                            <p className="text-sm text-text/80 font-mono">
                                {suggestion.targetItemId}
                            </p>
                        </div>
                    )}

                    {/* Suggestion ID */}
                    <div>
                        <h4 className="text-xs font-medium text-text/40 uppercase mb-1">
                            Suggestion ID
                        </h4>
                        <p className="text-sm text-text/80 font-mono">
                            {suggestion.id}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

function BatchSuggestionCard({
    batch,
    isExpanded,
    onToggleExpanded,
    onProcessed,
}: {
    batch: MenuScanBatchGroup<PendingMenuItemSuggestion>
    isExpanded: boolean
    onToggleExpanded: () => void
    onProcessed: (suggestionIds: string[]) => void
}) {
    const [isProcessing, setIsProcessing] = useState(false)

    const suggestionIds = batch.items.map((item) => item.id)
    const cafeLabel = batch.cafeName || `Cafe ${batch.cafeId.slice(0, 8)}`

    const handleApprove = async () => {
        setIsProcessing(true)
        const result = await approveMenuSuggestionBatch(batch.batchId)
        if (result.success) {
            onProcessed(suggestionIds)
        } else {
            alert(result.error || "Failed to approve this Menu scan")
        }
        setIsProcessing(false)
    }

    const handleReject = async () => {
        if (
            !confirm(
                `Are you sure you want to reject all ${batch.itemCount} items from this Menu scan?`
            )
        ) {
            return
        }
        setIsProcessing(true)
        const result = await rejectMenuSuggestionBatch(batch.batchId)
        if (result.success) {
            onProcessed(suggestionIds)
        } else {
            alert(result.error || "Failed to reject this Menu scan")
        }
        setIsProcessing(false)
    }

    return (
        <div className="bg-background shadow-sm border border-primary/40 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            {/* Header */}
            <div
                className="p-3 sm:p-4 cursor-pointer hover:bg-tertiary/10 transition flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
                onClick={onToggleExpanded}
            >
                <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-primary/20 text-primary">
                    <Store className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{cafeLabel}</h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary/15 text-primary">
                            Menu scan
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-tertiary/50 text-text/70 rounded-full">
                            {batch.itemCount} {batch.itemCount === 1 ? "item" : "items"}
                        </span>
                    </div>
                    <p className="text-sm text-text/60 truncate">
                        One review covers every item this scan found.
                    </p>
                    <p className="text-xs text-text/40">
                        {batch.items[0]?.createdAt
                            ? new Date(batch.items[0].createdAt).toLocaleDateString()
                            : "Unknown date"}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            handleApprove()
                        }}
                        disabled={isProcessing}
                        aria-label="Approve this scan"
                        title="Approve this scan"
                        className="p-2 bg-green-500/20 text-green-600 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50"
                    >
                        <Check className="w-5 h-5" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            handleReject()
                        }}
                        disabled={isProcessing}
                        aria-label="Reject this scan"
                        title="Reject this scan"
                        className="p-2 bg-red-500/20 text-red-600 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-text opacity-40" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-text opacity-40" />
                    )}
                </div>
            </div>

            {/* The scan's items */}
            {isExpanded && (
                <div className="border-t border-tertiary/50 p-4 space-y-2 bg-tertiary/10">
                    {batch.items.map((item) => {
                        const data = item.suggestedData

                        return (
                            <div
                                key={item.id}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-background rounded-lg px-3 py-2"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-text/80 truncate">
                                        {data.name || "Unnamed Item"}
                                    </p>
                                    <p className="text-xs text-text/40">{data.category}</p>
                                </div>
                                {data.price !== undefined && (
                                    <span className="text-sm font-medium text-text/80">
                                        ₱{data.price.toFixed(2)}
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default function MenuSuggestionQueue({
    suggestions,
    onProcessed,
}: MenuSuggestionQueueProps) {
    // One entry is expanded at a time, as the single-item queue always did.
    const [expandedEntry, setExpandedEntry] = useState<string | null>(null)
    const entries = groupMenuSuggestionQueue(suggestions)

    const toggleExpanded = (entryKey: string) => {
        setExpandedEntry((previous) => (previous === entryKey ? null : entryKey))
    }

    if (entries.length === 0) {
        return (
            <EmptyState
                icon={UtensilsCrossed}
                title="No pending menu suggestions"
                description="Community-submitted menu item suggestions will appear here for review."
            />
        )
    }

    return (
        <div className="space-y-3">
            {entries.map((entry) => {
                if (entry.kind === "batch") {
                    const entryKey = `batch:${entry.batch.batchId}`

                    return (
                        <BatchSuggestionCard
                            key={entryKey}
                            batch={entry.batch}
                            isExpanded={expandedEntry === entryKey}
                            onToggleExpanded={() => toggleExpanded(entryKey)}
                            onProcessed={onProcessed}
                        />
                    )
                }

                const entryKey = `single:${entry.suggestion.id}`

                return (
                    <SingleSuggestionCard
                        key={entryKey}
                        suggestion={entry.suggestion}
                        isExpanded={expandedEntry === entryKey}
                        onToggleExpanded={() => toggleExpanded(entryKey)}
                        onProcessed={onProcessed}
                    />
                )
            })}
        </div>
    )
}
