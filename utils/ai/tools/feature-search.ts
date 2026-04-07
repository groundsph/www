import { runCafeQuery } from "@/utils/ai/tools/cafe-query-runner"
import type { CafeQueryInput } from "@/utils/ai/tools/cafe-query"

export interface FeatureSearchResult {
    query: string
    cafes: unknown[]
    total: number
    appliedFeatures: string[]
}

export async function findCafesWithFeature(params: {
    city?: string
    province?: string
    features: string[]
    limit?: number
}): Promise<FeatureSearchResult | { error: string }> {
    try {
        const featureMap: Record<string, Partial<CafeQueryInput>> = {
            wifi: { hasWifi: true },
            sockets: { hasSockets: true },
            aircon: { hasAircon: true },
            "pet friendly": { isPetFriendly: true },
            "work friendly": { isWorkFriendly: true },
            food: { servesFood: true },
            outdoor: { hasOutdoorSeating: true },
            parking: { hasParking: true },
            halal: { isHalalCertified: true },
            decaf: { hasDecaf: true },
            "non-dairy": { hasNonDairy: true },
        }

        const queryInput: CafeQueryInput = {
            city: params.city,
            province: params.province,
            limit: params.limit ?? 20,
        }

        const appliedFeatures: string[] = []

        for (const feature of params.features) {
            const normalized = feature.toLowerCase().trim()
            if (featureMap[normalized]) {
                Object.assign(queryInput, featureMap[normalized])
                appliedFeatures.push(normalized)
            }
        }

        if (appliedFeatures.length === 0) {
            return { error: `Unknown features: ${params.features.join(", ")}. Available: ${Object.keys(featureMap).join(", ")}` }
        }

        const result = await runCafeQuery(queryInput)

        if ("error" in result) {
            return { error: result.error }
        }

        return {
            query: `Cafes with ${appliedFeatures.join(" + ")}${params.city ? ` in ${params.city}` : ""}`,
            cafes: result.cafes,
            total: result.total,
            appliedFeatures,
        }
    } catch (error) {
        console.error("findCafesWithFeature error:", error)
        return { error: "Failed to search cafes by features" }
    }
}
