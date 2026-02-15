import type { Metadata } from "next"

interface BuildPageMetadataInput {
    title: string
    description: string
    urlPath: string
    ogImagePath?: string
    index?: boolean
}

function getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "https://grounds.ph"
}

export function buildPageMetadata(input: BuildPageMetadataInput): Metadata {
    const baseUrl = getBaseUrl()
    const canonicalUrl = new URL(input.urlPath, baseUrl).toString()
    const imageUrl = input.ogImagePath
        ? new URL(input.ogImagePath, baseUrl).toString()
        : undefined

    return {
        title: input.title,
        description: input.description,
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            title: input.title,
            description: input.description,
            url: canonicalUrl,
            type: "website",
            images: imageUrl
                ? [{ url: imageUrl, width: 1200, height: 630, alt: input.title }]
                : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title: input.title,
            description: input.description,
            images: imageUrl ? [imageUrl] : undefined,
        },
        robots: input.index === false ? { index: false, follow: false } : undefined,
    }
}
