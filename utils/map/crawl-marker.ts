import { CAFE_PLACEHOLDER_URL } from "@/utils/extras"

export function buildCrawlMarkerHtml(input: { imageUrl: string | null; label?: string }) {
    const image = input.imageUrl || CAFE_PLACEHOLDER_URL
    const alt = input.label ?? "Cafe"

    return `
        <div class="crawl-marker-pin">
            <div class="crawl-marker-circle" style="background-image:url('${image}')" aria-label="${alt}"></div>
        </div>
    `.trim()
}
