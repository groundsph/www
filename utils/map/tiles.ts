// utils/map/tiles.ts
/**
 * Shared CARTO basemap tile URLs.
 *
 * As of 23 September 2026 CARTO requires an API key on every tile request under
 * basemaps.cartocdn.com. Keyless requests no longer return map data — they return
 * a watermark tile that reads "API KEY REQUIRED" / "carto.com/basemaps/apikey".
 *
 * Request a free key at https://carto.com/basemaps/apikey (no account needed) and
 * set NEXT_PUBLIC_CARTO_API_KEY in .env.local. Free tiers: 5M requests/month for
 * non-commercial use, 1M/month for commercial use.
 */

const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY ?? ""

/**
 * CARTO requires both attributions to stay visible on every map, including on
 * free tiers: "© OpenStreetMap contributors, © CARTO".
 */
export const CARTO_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/">CARTO</a>'

/**
 * Builds a CARTO raster tile URL, appending the API key when one is configured.
 * The `{r}` placeholder resolves to `@2x` on retina displays.
 */
function cartoRasterUrl(style: string): string {
    const base = `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`
    return CARTO_API_KEY
        ? `${base}?key=${encodeURIComponent(CARTO_API_KEY)}`
        : base
}

/** CARTO "Positron" light basemap, with place labels. */
export const CARTO_LIGHT_TILE_URL = cartoRasterUrl("light_all")

/** CARTO "Positron" light basemap, without place labels. */
export const CARTO_LIGHT_NOLABELS_TILE_URL = cartoRasterUrl("light_nolabels")

/** True when a CARTO key is configured; tiles are watermarked without one. */
export const hasCartoApiKey = CARTO_API_KEY.length > 0
