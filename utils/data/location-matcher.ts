import { PHILIPPINES_LOCATIONS, Region, Province } from "./philippines";

export interface NominatimAddress {
    city?: string;
    town?: string;
    municipality?: string;
    village?: string;
    suburb?: string;
    neighbourhood?: string;
    state?: string;
    region?: string;
    county?: string;
    state_district?: string;
    country?: string;
    [key: string]: unknown;
}

export interface GeocodedLocation {
    display_name: string;
    address: NominatimAddress;
}

export interface MatchedLocation {
    region: string | null;
    province: string | null;
    city: string | null;
    area: string | null;
    fullAddress: string;
}

const COMMON_SUFFIXES = [" City", " City of", " Municipality", " Municipality of", " Province", " Province of"];

function normalizeForMatch(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ñ/g, "n")
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .join(" ");
}

function removeSuffixes(str: string): string {
    let result = str;
    // Check against suffixes/prefixes logic (simplified for suffixes as per original, but "City of" is prefixish)
    // Actually, simple includes check in fuzzy match handles most.
    // We'll strip common noise words for stricter comparison if needed.
    return result;
}

function fuzzyMatch(candidate: string | undefined, target: string): number {
    if (!candidate) return 0;

    const normalizedCandidate = normalizeForMatch(candidate);
    const normalizedTarget = normalizeForMatch(target);

    // Exact match
    if (normalizedCandidate === normalizedTarget) return 100;

    // Substring match (Target contains Candidate or vice versa)
    if (normalizedTarget.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedTarget)) {
        // Penalty for length difference to avoid matching "Cebu" to "South Cotabato" (unlikely but "Cotabato" case)
        const lenDiff = Math.abs(normalizedTarget.length - normalizedCandidate.length);
        if (lenDiff > 10) return 60;
        return 80;
    }

    return 0;
}


function extractArea(nominatimAddress: NominatimAddress): string | null {
    const areaFields = [
        nominatimAddress.suburb,
        nominatimAddress.neighbourhood,
        nominatimAddress.village,
    ].filter(Boolean) as string[];

    if (areaFields.length === 0) return null;

    return areaFields[0];
}

export function matchNominatimToLocation(
    geocoded: GeocodedLocation,
): MatchedLocation {
    const { address, display_name } = geocoded;

    // Candidates from Nominatim
    const cityCandidates = [address.city, address.town, address.municipality, address.village].filter(Boolean) as string[];
    const provinceCandidates = [address.state, address.region, address.state_district, address.county].filter(Boolean) as string[];
    const regionCandidates = [address.region, address.state].filter(Boolean) as string[];

    let bestMatch: {
        region: string;
        province: string;
        city: string;
        score: number;
    } | null = null;

    // Iterate through all PH locations
    for (const region of PHILIPPINES_LOCATIONS.regions) {
        // Region Score
        let regionScore = 0;
        for (const candidate of regionCandidates) {
            const score = fuzzyMatch(candidate, region.name);
            if (score > regionScore) regionScore = score;
        }

        for (const province of region.provinces) {
            // Province Score
            let provinceScore = 0;
            // Metro Manila special handling: Nominatim returns "Metro Manila" as region, but it's a Province in our data
            const effProvinceCandidates = [...provinceCandidates];

            for (const candidate of effProvinceCandidates) {
                const score = fuzzyMatch(candidate, province.name);
                if (score > provinceScore) provinceScore = score;
            }

            for (const city of province.cities) {
                // City Score
                let cityScore = 0;
                for (const candidate of cityCandidates) {
                    const score = fuzzyMatch(candidate, city);
                    if (score > cityScore) cityScore = score;
                }

                if (cityScore > 0) {
                    // Total Score = City (high weight) + Province (med) + Region (low)
                    // We prioritize City match heavily because it's the most specific
                    const totalScore = (cityScore * 3) + (provinceScore * 2) + (regionScore * 1);

                    if (!bestMatch || totalScore > bestMatch.score) {
                        bestMatch = {
                            region: region.name,
                            province: province.name,
                            city: city,
                            score: totalScore
                        };
                    }
                }
            }
        }
    }

    // If no city matched, try to fall back to just matching province?
    // The current requirement implies we need city. If Nominatim gives a city, we should match it.
    // If Nominatim gives no city (e.g. just coordinates in a field), we might fail.
    // But usually address has *something*.

    return {
        region: bestMatch?.region || null,
        province: bestMatch?.province || null,
        city: bestMatch?.city || null,
        area: extractArea(address),
        fullAddress: display_name,
    };
}
