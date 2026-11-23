import { describe, it, expect, afterEach } from "bun:test"
import { render, screen, cleanup } from "@testing-library/react"
import CafeEditBanner from "@/components/cafe/CafeEditBanner"

/**
 * Seam S5, the banner half: the affordance points at the surface each role
 * actually maintains the Cafe from.
 */

const CAFE_ID = "cafe-kape-lolo"
const CAFE_SLUG = "kape-lolo"

function bannerHref(role: "admin" | "moderator" | "owner"): string | null {
    render(
        <CafeEditBanner
            cafeId={CAFE_ID}
            cafeSlug={CAFE_SLUG}
            cafeName='Kape Lolo'
            role={role}
        />
    )
    const link = screen.getByRole("link", { name: "Edit Cafe" })
    return link.getAttribute("href")
}

describe("CafeEditBanner — owner", () => {
    afterEach(() => {
        cleanup()
    })

    it("sends an owner to the owner editor for this Cafe", () => {
        expect(bannerHref("owner")).toBe("/owner/cafes/kape-lolo/edit")
    })

    it("names the owner's access, not a staff role", () => {
        render(
            <CafeEditBanner
                cafeId={CAFE_ID}
                cafeSlug={CAFE_SLUG}
                cafeName='Kape Lolo'
                role='owner'
            />
        )

        expect(screen.getByText("Owner Access")).toBeTruthy()
        expect(screen.queryByText("Admin Access")).toBeNull()
        expect(screen.queryByText("Moderator Access")).toBeNull()
    })
})

describe("CafeEditBanner — staff unchanged", () => {
    afterEach(() => {
        cleanup()
    })

    it("sends an admin to the moderation preview", () => {
        expect(bannerHref("admin")).toBe("/manage/preview/cafe-kape-lolo")
    })

    it("sends a moderator to the moderation preview", () => {
        expect(bannerHref("moderator")).toBe("/manage/preview/cafe-kape-lolo")
    })

    it("never sends staff to the owner editor", () => {
        expect(bannerHref("admin")).not.toContain("/owner/")
        cleanup()
        expect(bannerHref("moderator")).not.toContain("/owner/")
    })
})
