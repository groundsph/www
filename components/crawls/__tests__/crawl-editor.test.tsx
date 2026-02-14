import { describe, it, expect } from "bun:test"
import { existsSync } from "fs"
import { join } from "path"
import CrawlRouteMap from "@/components/map/CrawlRouteMap"

describe("CrawlEditor", () => {
    it("CrawlEditor component file exists", () => {
        const filePath = join(process.cwd(), "components", "crawls", "CrawlEditor.tsx")
        expect(existsSync(filePath)).toBe(true)
    })

    it("Create page file exists", () => {
        const filePath = join(process.cwd(), "app", "community", "crawls", "create", "page.tsx")
        expect(existsSync(filePath)).toBe(true)
    })

    it("Edit page file exists", () => {
        const filePath = join(process.cwd(), "app", "community", "crawls", "[slug]", "edit", "page.tsx")
        expect(existsSync(filePath)).toBe(true)
    })
})

describe("CrawlRouteMap focusPoint", () => {
    it("accepts focusPoint prop", () => {
        const element = CrawlRouteMap({
            points: [{ lat: 14.5995, lng: 120.9842 }],
            focusPoint: { lat: 14.5995, lng: 120.9842 },
        })
        expect(element).toBeDefined()
    })

    it("accepts null focusPoint prop", () => {
        const element = CrawlRouteMap({
            points: [],
            focusPoint: null,
        })
        expect(element).toBeDefined()
    })

    it("accepts undefined focusPoint prop", () => {
        const element = CrawlRouteMap({
            points: [],
            focusPoint: undefined,
        })
        expect(element).toBeDefined()
    })
})
