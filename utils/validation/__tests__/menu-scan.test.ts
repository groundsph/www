import { describe, it, expect } from "bun:test"
import {
    MENU_SCAN_ACCEPT_ATTRIBUTE,
    MENU_SCAN_LIMITS_COPY,
    MENU_SCAN_MAX_FILE_BYTES,
    MENU_SCAN_MAX_PAGES,
    describeMenuScanFileProblem,
    menuScanItemKey,
    partitionMenuScanFiles,
} from "@/utils/validation/menu-scan"

const MB = 1024 * 1024

describe("menu scan file limits", () => {
    it("states, offers and enforces exactly JPEG, PNG and WebP", () => {
        // Written out here rather than derived from the module, so the tile copy,
        // the file input's accept attribute and the check cannot drift apart.
        expect(MENU_SCAN_LIMITS_COPY).toBe("JPEG, PNG, WebP up to 10 MB")
        expect(MENU_SCAN_ACCEPT_ATTRIBUTE).toBe("image/jpeg,image/png,image/webp")
        expect(MENU_SCAN_MAX_FILE_BYTES).toBe(10 * MB)
    })

    it("accepts the three offered formats under the stated size", () => {
        for (const type of ["image/jpeg", "image/png", "image/webp"]) {
            expect(describeMenuScanFileProblem({ type, size: 2 * MB })).toBeNull()
        }
    })

    it("accepts a file of exactly the stated size", () => {
        expect(
            describeMenuScanFileProblem({ type: "image/jpeg", size: 10 * MB })
        ).toBeNull()
    })

    it("refuses a format the tile does not list", () => {
        const problem = describeMenuScanFileProblem({
            type: "image/gif",
            size: 2 * MB,
        })
        expect(problem).toContain("JPEG, PNG, or WebP")
    })

    it("refuses a non-image file", () => {
        expect(
            describeMenuScanFileProblem({
                type: "application/pdf",
                size: 2 * MB,
            })
        ).not.toBeNull()
    })

    it("refuses a file one byte over the stated size", () => {
        const problem = describeMenuScanFileProblem({
            type: "image/jpeg",
            size: 10 * MB + 1,
        })
        expect(problem).toContain("10 MB")
    })
})

describe("partitionMenuScanFiles", () => {
    const ok = (name: string, type = "image/jpeg", size = 1024) =>
        ({ name, type, size }) as { name: string; type: string; size: number }

    it("accepts every page of a valid multi-page selection, in order", () => {
        const files = [ok("p1.jpg"), ok("p2.png", "image/png"), ok("p3.webp", "image/webp")]
        const { accepted, rejected } = partitionMenuScanFiles(files)

        expect(accepted.map((f) => f.name)).toEqual(["p1.jpg", "p2.png", "p3.webp"])
        expect(rejected).toEqual([])
    })

    it("keeps the valid pages and names the one that is the wrong format", () => {
        const { accepted, rejected } = partitionMenuScanFiles([
            ok("p1.jpg"),
            ok("menu.heic", "image/heic"),
            ok("p3.jpg"),
        ])

        expect(accepted.map((f) => f.name)).toEqual(["p1.jpg", "p3.jpg"])
        expect(rejected).toHaveLength(1)
        expect(rejected[0].name).toBe("menu.heic")
        expect(rejected[0].reason).toBeTruthy()
    })

    it("names the file that is over the stated size", () => {
        const { accepted, rejected } = partitionMenuScanFiles([
            ok("big.jpg", "image/jpeg", 10 * 1024 * 1024 + 1),
        ])

        expect(accepted).toHaveLength(0)
        expect(rejected[0].name).toBe("big.jpg")
    })

    it("caps the number of pages and says so for the extras", () => {
        const files = Array.from({ length: MENU_SCAN_MAX_PAGES + 2 }, (_, i) => ok(`p${i}.jpg`))
        const { accepted, rejected } = partitionMenuScanFiles(files)

        expect(accepted).toHaveLength(MENU_SCAN_MAX_PAGES)
        expect(rejected).toHaveLength(2)
        expect(rejected[0].reason).toContain(String(MENU_SCAN_MAX_PAGES))
    })
})

describe("menuScanItemKey", () => {
    it("collapses case and spacing so a repeated line is recognised across pages", () => {
        expect(menuScanItemKey("  Iced   Latte ")).toBe(menuScanItemKey("iced latte"))
    })

    it("keeps genuinely different items apart", () => {
        expect(menuScanItemKey("Latte")).not.toBe(menuScanItemKey("Latte Macchiato"))
    })
})
