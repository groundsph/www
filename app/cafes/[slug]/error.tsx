"use client"

import { useEffect } from "react"
import Link from "next/link"
import { RotateCw, TriangleAlert } from "lucide-react"

interface CafeErrorProps {
    /** The value thrown while rendering the Cafe segment. */
    error: unknown
    /** Re-fetches and re-renders the segment's children. */
    retry: () => void
}

/**
 * Error boundary for the Cafe route segment (`/cafes/[slug]` and its children).
 *
 * A render failure on a Cafe page recovers here instead of falling through to
 * the app's outermost error handling: the visitor keeps the site shell, and the
 * retry button asks the framework to render the segment again.
 */
export default function CafeError({ error, retry }: CafeErrorProps) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <section
            id="cafe-error"
            className="w-full flex-1 flex flex-col items-center justify-center px-4 py-24 text-center"
        >
            <TriangleAlert
                className="w-12 h-12 mb-4 opacity-30"
                aria-hidden="true"
            />
            <h1 className="text-3xl font-bold">This cafe page did not load</h1>
            <p className="mt-3 max-w-md text-base text-text/60">
                Something went wrong while building the page. Trying again
                often fixes it.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
                <button
                    type="button"
                    onClick={() => retry()}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                    <RotateCw className="w-4 h-4" aria-hidden="true" />
                    Try again
                </button>
                <Link
                    href="/cafes"
                    className="rounded-full border border-text/15 px-5 py-2 text-sm font-semibold transition-colors hover:bg-text/5"
                >
                    Browse cafes
                </Link>
            </div>
        </section>
    )
}
