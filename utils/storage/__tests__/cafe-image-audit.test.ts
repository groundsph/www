import { describe, it, expect } from "bun:test"
import { collectCafeImageUrls, summarizeBrokenImages } from "@/utils/storage/cafe-image-audit"

const row = {
    id: "cafe-1",
    name: "Kapi & Co.",
    thumbnail: "https://cdn.grounds.ph/cafes/aaa/cover.webp",
    gallery: ["https://cdn.grounds.ph/cafes/aaa/one.webp", "https://cdn.grounds.ph/cafes/aaa/one.webp"],
}

describe("collectCafeImageUrls", () => {
    it("collects the cover and de-duplicated gallery URLs", () => {
        const collected = collectCafeImageUrls([row])
        expect(collected.map((entry) => entry.url)).toEqual([
            "https://cdn.grounds.ph/cafes/aaa/cover.webp",
            "https://cdn.grounds.ph/cafes/aaa/one.webp",
        ])
    })

    it("skips placeholder covers and empty galleries", () => {
        const collected = collectCafeImageUrls([
            { id: "cafe-2", name: "Empty", thumbnail: "placeholder", gallery: null },
            { id: "cafe-3", name: "No cover", thumbnail: null, gallery: [] },
        ])
        expect(collected).toEqual([])
    })
})

describe("summarizeBrokenImages", () => {
    it("reports only the unreachable URLs grouped by cafe", () => {
        const summary = summarizeBrokenImages([
            { cafeId: "cafe-1", cafeName: "Kapi", url: "a.webp", status: 404 },
            { cafeId: "cafe-1", cafeName: "Kapi", url: "b.webp", status: 200 },
        ])
        expect(summary).toEqual([{ cafeId: "cafe-1", cafeName: "Kapi", brokenUrls: ["a.webp"] }])
    })

    it("treats a network failure as broken", () => {
        const summary = summarizeBrokenImages([
            { cafeId: "cafe-2", cafeName: "Down", url: "c.webp", status: null },
        ])
        expect(summary[0].brokenUrls).toEqual(["c.webp"])
    })

    it("reports nothing when every image resolves", () => {
        expect(summarizeBrokenImages([
            { cafeId: "cafe-3", cafeName: "Fine", url: "d.webp", status: 200 },
        ])).toEqual([])
    })
})
