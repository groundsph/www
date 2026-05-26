/**
 * Slugify a string: NFD-normalize (strip accents), lowercase, remove non-alphanumeric, collapse dashes.
 */
export function slugify(s: string): string {
  const result = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")     // Remove non-alphanumeric except spaces and dashes
    .replace(/\s+/g, "-")             // Spaces to dashes
    .replace(/-+/g, "-")              // Collapse multiple dashes
    .replace(/^-+|-+$/g, "")          // Trim leading/trailing dashes
    || "cafe"                         // Fallback for empty result

  // Truncate to 200 chars max, stripping any trailing dash
  if (result.length > 200) {
    return result.slice(0, 200).replace(/-$/, "")
  }
  return result
}

export function generateSlug(name: string, cityMunicipality?: string, province?: string): string {
  const nameSlug = slugify(name) || "cafe"

  if (cityMunicipality && province) {
    const citySlug = slugify(cityMunicipality)
    const provSlug = slugify(province)

    let locationSlug = ""
    if (citySlug && provSlug) locationSlug = `${citySlug}-${provSlug}`
    else if (provSlug) locationSlug = provSlug

    if (locationSlug) {
      const combined = `${nameSlug}-${locationSlug}`
      return combined.length > 200 ? combined.slice(0, 200).replace(/-$/, "") : combined
    }
  }

  return nameSlug.length > 200 ? nameSlug.slice(0, 200).replace(/-$/, "") : nameSlug
}

export const MAX_SLUG_ITERATIONS = 100