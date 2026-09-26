import { describe, expect, it } from "bun:test"
import {
    CARTO_ATTRIBUTION,
    CARTO_LIGHT_NOLABELS_TILE_URL,
    CARTO_LIGHT_TILE_URL,
} from "@/utils/map/tiles"

// NOTE: these assertions intentionally do not depend on whether a CARTO key is
// configured in the environment — only on the URL shape. CI/`.env.local` with and
// without NEXT_PUBLIC_CARTO_API_KEY must both pass.

describe("utils/map/tiles", () => {
    it("serves CARTO raster tiles with the Leaflet placeholders intact", () => {
        for (const url of [CARTO_LIGHT_TILE_URL, CARTO_LIGHT_NOLABELS_TILE_URL]) {
            expect(url).toContain("basemaps.cartocdn.com")
            expect(url).toContain("{s}")
            expect(url).toContain("{z}/{x}/{y}{r}.png")
        }
    })

    it("uses the light_all style for labelled tiles", () => {
        expect(CARTO_LIGHT_TILE_URL).toContain("/light_all/")
    })

    it("uses the light_nolabels style for unlabelled tiles", () => {
        expect(CARTO_LIGHT_NOLABELS_TILE_URL).toContain("/light_nolabels/")
    })

    it("appends the key query param only when a key is configured", () => {
        // Guards against the pre-fix bug: CARTO now returns a watermark tile
        // reading "API KEY REQUIRED" for keyless requests.
        const hasKey = process.env.NEXT_PUBLIC_CARTO_API_KEY
        if (hasKey) {
            expect(CARTO_LIGHT_TILE_URL).toContain(`?key=${encodeURIComponent(hasKey)}`)
            expect(CARTO_LIGHT_NOLABELS_TILE_URL).toContain(
                `?key=${encodeURIComponent(hasKey)}`
            )
        } else {
            expect(CARTO_LIGHT_TILE_URL).not.toContain("?key=")
            expect(CARTO_LIGHT_NOLABELS_TILE_URL).not.toContain("?key=")
        }
    })

    it("keeps the key after the file extension so Leaflet still finds {r}", () => {
        // A key inserted before ".png" would break tile URLs.
        for (const url of [CARTO_LIGHT_TILE_URL, CARTO_LIGHT_NOLABELS_TILE_URL]) {
            const keyIndex = url.indexOf("?key=")
            if (keyIndex !== -1) expect(keyIndex).toBeGreaterThan(url.indexOf(".png"))
        }
    })

    it("credits both OpenStreetMap and CARTO, as CARTO's terms require", () => {
        expect(CARTO_ATTRIBUTION).toContain("OpenStreetMap")
        expect(CARTO_ATTRIBUTION).toContain("carto.com")
    })
})
