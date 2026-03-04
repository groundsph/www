import { describe, it, expect, vi } from "bun:test"
import { render } from "@testing-library/react"
import CrawlCard from "@/components/crawls/CrawlCard"

// Mock web-haptics for tests
vi.mock("web-haptics/react", () => ({
    useWebHaptics: () => ({
        trigger: vi.fn(),
        cancel: vi.fn(),
        isSupported: false,
    }),
}))

// Mock next/navigation
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}))

describe("CrawlCard", () => {
    it("exports a component", () => {
        expect(typeof CrawlCard).toBe("function")
    })

    it("has correct displayName", () => {
        expect(CrawlCard.name).toBe("CrawlCard")
    })

    it("renders with crawl data", () => {
        const mockCrawl = {
            id: "1",
            title: "Test Crawl",
            slug: "test-crawl",
            coverImage: null,
            itemCount: 5,
            viewsCount: 100,
            savesCount: 10,
        }

        const { container } = render(<CrawlCard crawl={mockCrawl} />)
        expect(container.querySelector('a')?.getAttribute('href')).toBe("/community/crawls/test-crawl")
    })
})
