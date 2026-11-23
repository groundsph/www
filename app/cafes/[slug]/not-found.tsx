import Link from "next/link"
import { Coffee } from "lucide-react"

/**
 * Not-found boundary for the Cafe route segment, covering `/cafes/[slug]` and
 * everything below it, including `/cafes/[slug]/menu`.
 *
 * A Cafe that does not exist and a Cafe that exists but is not published both
 * arrive here — neither the page nor the menu page can tell them apart, so this
 * output is deliberately the same for both: no Cafe name, no distinguishing
 * copy. An unpublished listing must not be discoverable by probing its URL.
 */
export default function CafeNotFound() {
    return (
        <section
            id="not-found"
            className="w-full flex-1 flex flex-col items-center justify-center px-4 py-24 text-center"
        >
            <Coffee className="w-12 h-12 mb-4 opacity-30" aria-hidden="true" />
            <p className="text-sm font-semibold tracking-wide text-text/40">
                404
            </p>
            <h1 className="mt-2 text-3xl font-bold">No such cafe</h1>
            <p className="mt-3 max-w-md text-base text-text/60">
                This page is not available. The link may be out of date, or the
                cafe may no longer be listed.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
                <Link
                    href="/cafes"
                    className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                    Browse cafes
                </Link>
                <Link
                    href="/"
                    className="rounded-full border border-text/15 px-5 py-2 text-sm font-semibold transition-colors hover:bg-text/5"
                >
                    Go back home
                </Link>
            </div>
        </section>
    )
}
