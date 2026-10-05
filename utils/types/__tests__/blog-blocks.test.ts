import { describe, it, expect } from "bun:test"
import {
    blocksToMarkdown,
    collectBlockCafeIds,
    collectBlockCrawlIds,
    createBlock,
    extractVideoId,
    hasRenderableContent,
    inferEmbedProvider,
    legacyContentToBlocks,
    normalizeBlocks,
    pruneEmptyTextBlocks,
    type BlogBlock,
} from "@/utils/types/blog-blocks"

describe("createBlock", () => {
    it("creates a block with a unique id", () => {
        const a = createBlock("text")
        const b = createBlock("text")
        expect(a.type).toBe("text")
        expect(a.id).toBeTruthy()
        expect(a.id).not.toBe(b.id)
    })

    it("creates type-specific defaults", () => {
        expect(createBlock("heading")).toMatchObject({ type: "heading", level: 2 })
        expect(createBlock("callout")).toMatchObject({ type: "callout", variant: "info" })
        expect(createBlock("code")).toMatchObject({ type: "code", language: "text" })
        expect(createBlock("gallery")).toMatchObject({ type: "gallery", images: [] })
    })
})

describe("normalizeBlocks", () => {
    it("returns an empty array for non-arrays", () => {
        expect(normalizeBlocks(null)).toEqual([])
        expect(normalizeBlocks("nope")).toEqual([])
        expect(normalizeBlocks({ type: "text" })).toEqual([])
    })

    it("drops unknown block types and invalid blocks", () => {
        const result = normalizeBlocks([
            { type: "text", content: "hello" },
            { type: "bogus", foo: 1 },
            { type: "image", url: "" },
            { type: "cafe", cafeId: "c1" },
            null,
            42,
        ])
        expect(result).toHaveLength(2)
        expect(result[0]).toMatchObject({ type: "text", content: "hello" })
        expect(result[1]).toMatchObject({ type: "cafe", cafeId: "c1" })
    })

    it("assigns ids to blocks missing one", () => {
        const [block] = normalizeBlocks([{ type: "heading", text: "Hi", level: 3 }])
        expect(block.id).toBeTruthy()
        expect(block).toMatchObject({ type: "heading", level: 3 })
    })

    it("coerces invalid heading levels to 2 and unknown callouts to info", () => {
        const [heading] = normalizeBlocks([{ type: "heading", text: "x", level: 9 }])
        const [callout] = normalizeBlocks([{ type: "callout", content: "x", variant: "danger" }])
        expect(heading).toMatchObject({ level: 2 })
        expect(callout).toMatchObject({ variant: "info" })
    })

    it("infers the embed provider from the url", () => {
        const [block] = normalizeBlocks([
            { type: "embed", url: "https://www.youtube.com/watch?v=abc123456" },
        ])
        expect(block).toMatchObject({ type: "embed", provider: "youtube" })
    })
})

describe("blocksToMarkdown", () => {
    it("projects text, headings, quotes and callouts", () => {
        const blocks: BlogBlock[] = [
            { id: "1", type: "text", content: "Intro paragraph" },
            { id: "2", type: "heading", text: "Section", level: 2 },
            { id: "3", type: "quote", content: "Beans", attribution: "Me" },
            { id: "4", type: "callout", variant: "tip", content: "Grind fresh" },
        ]
        const md = blocksToMarkdown(blocks)
        expect(md).toContain("Intro paragraph")
        expect(md).toContain("## Section")
        expect(md).toContain("> Beans")
        expect(md).toContain("— Me")
        expect(md).toContain("> **TIP**: Grind fresh")
    })

    it("omits non-textual blocks (cafes, maps, crawls)", () => {
        const blocks: BlogBlock[] = [
            { id: "1", type: "text", content: "Body" },
            { id: "2", type: "cafe-carousel", cafeIds: ["a", "b"] },
            { id: "3", type: "map", cafeIds: ["a"] },
            { id: "4", type: "crawl", crawlId: "c1" },
        ]
        expect(blocksToMarkdown(blocks)).toBe("Body")
    })

    it("renders images and galleries as markdown images", () => {
        const blocks: BlogBlock[] = [
            { id: "1", type: "image", url: "https://img/1.jpg", caption: "Nice" },
            {
                id: "2",
                type: "gallery",
                images: [{ url: "https://img/2.jpg" }, { url: "https://img/3.jpg" }],
            },
        ]
        const md = blocksToMarkdown(blocks)
        expect(md).toContain("![Nice](https://img/1.jpg)")
        expect(md).toContain("![](https://img/2.jpg)")
        expect(md).toContain("![](https://img/3.jpg)")
    })

    it("fences code and widens the fence when needed", () => {
        const single = blocksToMarkdown([
            { id: "1", type: "code", language: "ts", code: "const a = 1" },
        ])
        expect(single).toBe("```ts\nconst a = 1\n```")

        const nested = blocksToMarkdown([
            { id: "1", type: "code", language: "md", code: "```js\nx\n```" },
        ])
        expect(nested.startsWith("````md")).toBe(true)
    })
})

describe("hasRenderableContent / pruneEmptyTextBlocks", () => {
    it("treats an image-only post as renderable", () => {
        expect(
            hasRenderableContent([{ id: "1", type: "image", url: "https://img/1.jpg" }])
        ).toBe(true)
    })

    it("treats whitespace-only text as empty", () => {
        expect(hasRenderableContent([{ id: "1", type: "text", content: "   " }])).toBe(false)
    })

    it("drops empty text and heading blocks", () => {
        const pruned = pruneEmptyTextBlocks([
            { id: "1", type: "text", content: "  " },
            { id: "2", type: "heading", text: "" },
            { id: "3", type: "image", url: "https://img/1.jpg" },
        ])
        expect(pruned).toHaveLength(1)
        expect(pruned[0].type).toBe("image")
    })
})

describe("legacyContentToBlocks", () => {
    it("converts content, images and cafes in viewer order", () => {
        const blocks = legacyContentToBlocks({
            content: "# Title\n\nBody",
            images: ["a.jpg", "b.jpg"],
            cafeIds: ["c1", "c2", "c3"],
            crawlId: "crawl-1",
        })
        expect(blocks.map((b) => b.type)).toEqual([
            "text",
            "gallery",
            "cafe-carousel",
            "crawl",
        ])
    })

    it("uses a single image block for one image and a cafe block for one cafe", () => {
        const blocks = legacyContentToBlocks({
            content: "Body",
            images: ["only.jpg"],
            cafeIds: ["c1"],
        })
        expect(blocks.map((b) => b.type)).toEqual(["text", "image", "cafe"])
    })

    it("skips empty content and missing media", () => {
        const blocks = legacyContentToBlocks({ content: "   ", images: [], cafeIds: [] })
        expect(blocks).toEqual([])
    })
})

describe("collectBlockCafeIds / collectBlockCrawlIds", () => {
    it("dedupes cafe ids across cafe, carousel and map blocks", () => {
        const blocks: BlogBlock[] = [
            { id: "1", type: "cafe", cafeId: "a" },
            { id: "2", type: "cafe-carousel", cafeIds: ["a", "b"] },
            { id: "3", type: "map", cafeIds: ["c", "b"] },
        ]
        expect(collectBlockCafeIds(blocks).sort()).toEqual(["a", "b", "c"])
    })

    it("collects crawl ids", () => {
        const blocks: BlogBlock[] = [
            { id: "1", type: "crawl", crawlId: "x" },
            { id: "2", type: "crawl", crawlId: "x" },
            { id: "3", type: "crawl", crawlId: "y" },
        ]
        expect(collectBlockCrawlIds(blocks).sort()).toEqual(["x", "y"])
    })
})

describe("embed helpers", () => {
    it("infers providers", () => {
        expect(inferEmbedProvider("https://youtu.be/abc")).toBe("youtube")
        expect(inferEmbedProvider("https://vimeo.com/123")).toBe("vimeo")
        expect(inferEmbedProvider("https://example.com")).toBe("link")
    })

    it("extracts video ids", () => {
        expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
            "dQw4w9WgXcQ"
        )
        expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
        expect(extractVideoId("https://vimeo.com/123456")).toBe("123456")
        expect(extractVideoId("https://example.com")).toBeNull()
    })
})
