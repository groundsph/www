import { CAFE_PLACEHOLDER_URL } from "@/utils/extras"

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

export function buildCrawlMarkerHtml(input: { imageUrl: string | null; label?: string }) {
    const image = escapeHtml(input.imageUrl || CAFE_PLACEHOLDER_URL)
    const alt = escapeHtml(input.label ?? "Cafe")

    return `
        <div class="crawl-marker-pin">
            <div class="crawl-marker-circle" style="background-image:url('${image}')" aria-label="${alt}"></div>
        </div>
    `.trim()
}
