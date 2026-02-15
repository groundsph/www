import type { Metadata } from "next"
import { buildPageMetadata } from "@/utils/seo/metadata"

interface BuildShareMetadataInput {
    title: string
    description: string
    ogImageUrl: string
    urlPath?: string
}

export function buildShareMetadata(input: BuildShareMetadataInput): Metadata {
    if (input.urlPath) {
        return buildPageMetadata({
            title: input.title,
            description: input.description,
            urlPath: input.urlPath,
            ogImagePath: input.ogImageUrl,
        })
    }

    return {
        title: input.title,
        description: input.description,
        openGraph: {
            title: input.title,
            description: input.description,
            images: [
                {
                    url: input.ogImageUrl,
                    width: 1200,
                    height: 630,
                    alt: input.title,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: input.title,
            description: input.description,
            images: [input.ogImageUrl],
        },
    }
}

export function buildCrawlShareMetadata(input: BuildShareMetadataInput): Metadata {
    return buildShareMetadata(input)
}
