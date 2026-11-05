import { describe, it, expect, beforeAll } from "bun:test"
import { renderToStaticMarkup, renderToReadableStream } from "react-dom/server"
import VerificationApprovedEmail from "@/emails/VerificationApprovedEmail"

const template = () => (
    <VerificationApprovedEmail cafeName="Kape Ni Juan" cafeSlug="kape-ni-juan" />
)

const render = () => renderToStaticMarkup(template())

beforeAll(async () => {
    // @react-email/components' <Tailwind> suspends on its very first render: it
    // throws a promise while compiling the theme, which the synchronous legacy
    // renderer cannot resolve. Warm the cache through the streaming renderer so
    // every assertion below can use plain renderToStaticMarkup.
    const stream = await renderToReadableStream(template())
    await stream.allReady
    await stream.cancel()
})

describe("VerificationApprovedEmail", () => {
    it("names the cafe", () => {
        expect(render()).toContain("Kape Ni Juan")
    })

    it("links to the owner dashboard", () => {
        expect(render()).toContain("/owner")
    })

    it("never promises a verified badge", () => {
        const html = render().toLowerCase()
        expect(html).not.toContain("verified badge")
        expect(html).not.toContain("badge")
    })

    it("never calls the owner a verified owner", () => {
        const html = render().toLowerCase()
        expect(html).not.toContain("verified owner")
        expect(html).not.toContain("is_verified")
    })

    it("says the ownership verification was approved", () => {
        const html = render().toLowerCase()
        expect(html).toContain("ownership verification")
        expect(html).toContain("approved")
        expect(html).toContain("you now manage this cafe")
    })
})
