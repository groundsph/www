import { describe, it, expect, beforeAll } from "bun:test"
import { renderToStaticMarkup, renderToReadableStream } from "react-dom/server"
import ClaimApprovedEmail from "@/emails/ClaimApprovedEmail"

const template = () => (
    <ClaimApprovedEmail cafeName="Kape Ni Juan" cafeSlug="kape-ni-juan" />
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

describe("ClaimApprovedEmail", () => {
    it("never promises a verified badge", () => {
        const html = render().toLowerCase()
        expect(html).not.toContain("verified badge")
    })

    it("never calls the owner a verified owner", () => {
        const html = render().toLowerCase()
        expect(html).not.toContain("verified owner")
    })

    it("still tells the owner what they can do", () => {
        const html = render().toLowerCase()
        expect(html).toContain("update your cafe")
        expect(html).toContain("respond to customer reviews")
        expect(html).toContain("share your cafe")
    })

    it("still links to the owner dashboard", () => {
        const html = render()
        expect(html).toContain("/owner")
    })

    it("still names the cafe", () => {
        expect(render()).toContain("Kape Ni Juan")
    })
})
