import { describe, it, expect } from "bun:test"
import SavedCrawlsList from "@/components/crawls/SavedCrawlsList"
import type { CafeCrawlListItem } from "@/app/api/actions/cafe-crawls"

describe("SavedCrawlsList", () => {
    it("exports a component", () => {
        expect(typeof SavedCrawlsList).toBe("function")
    })

    it("renders without crashing with empty crawls", () => {
        const element = SavedCrawlsList({ crawls: [] })
        expect(element).toBeDefined()
    })

    it("renders without crashing with crawls", () => {
        const crawls: CafeCrawlListItem[] = [
            {
                id: "1",
                title: "Crawl 1",
                slug: "crawl-1",
                description: "Test description",
                coverImage: null,
                itemCount: 3,
                viewsCount: 100,
                savesCount: 10,
                createdAt: "2024-01-01T00:00:00Z",
                author: {
                    id: "user1",
                    username: "testuser",
                    displayName: "Test User",
                    avatarUrl: null,
                },
            },
        ]
        const element = SavedCrawlsList({ crawls })
        expect(element).toBeDefined()
    })

    it("has correct displayName", () => {
        expect(SavedCrawlsList.name).toBe("SavedCrawlsList")
    })
})
