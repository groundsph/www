import { describe, it, expect } from "bun:test"
import { existsSync, readFileSync } from "fs"
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

describe("CrawlEditor Layout", () => {
    it("orders sections: cover/title/desc, route, add cafes, list", () => {
        const filePath = join(process.cwd(), "components", "crawls", "CrawlEditor.tsx")
        const source = readFileSync(filePath, "utf-8")
        const coverIndex = source.indexOf("Cover Image")
        const routeIndex = source.indexOf("Route Preview")
        const addIndex = source.indexOf("Add Cafes")
        const listIndex = source.indexOf("Cafes (")
        expect(coverIndex).toBeGreaterThan(-1)
        expect(routeIndex).toBeGreaterThan(coverIndex)
        expect(addIndex).toBeGreaterThan(routeIndex)
        expect(listIndex).toBeGreaterThan(addIndex)
    })
})
