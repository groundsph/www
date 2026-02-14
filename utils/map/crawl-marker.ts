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
    cafeSlug?: string
    showTooltip?: boolean
}) {
    const image = escapeHtml(input.imageUrl || CAFE_PLACEHOLDER_URL)
    const alt = escapeHtml(input.label ?? "Cafe")
    const number = typeof input.index === "number" ? input.index : null
    const name = input.label ? escapeHtml(input.label) : null
    const showTooltipClass = input.showTooltip ? "has-tooltip" : ""

    return `
        <div class="crawl-marker-pin ${showTooltipClass}" data-cafe-slug="${input.cafeSlug || ''}">
            ${number !== null ? `<div class="crawl-marker-number">${number}</div>` : ""}
            <div class="crawl-marker-circle" style="background-image:url('${image}')" aria-label="${alt}"></div>
            ${name ? `<div class="crawl-marker-tooltip">${name}</div>` : ""}
        </div>
    `.trim()
}
