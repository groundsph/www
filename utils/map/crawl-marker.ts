import { CAFE_PLACEHOLDER_URL } from "@/utils/extras"

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

export function buildCrawlMarkerHtml(input: {
    imageUrl: string | null
    label?: string
    index?: number
}) {
    const image = escapeHtml(input.imageUrl || CAFE_PLACEHOLDER_URL)
    const alt = escapeHtml(input.label ?? "Cafe")
    const number = typeof input.index === "number" ? input.index : null

    return `
        <div class="crawl-marker-pin">
            ${number !== null ? `<div class="crawl-marker-number">${number}</div>` : ""}
            <div class="crawl-marker-circle" style="background-image:url('${image}')" aria-label="${alt}"></div>
        </div>
    `.trim()
}
