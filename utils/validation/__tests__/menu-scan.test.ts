import { describe, it, expect } from "bun:test"
import {
    MENU_SCAN_ACCEPT_ATTRIBUTE,
    MENU_SCAN_LIMITS_COPY,
    MENU_SCAN_MAX_FILE_BYTES,
    describeMenuScanFileProblem,
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
