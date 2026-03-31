import { describe, it, expect } from "bun:test"
import { generateSlug, estimateReadingTime } from "../blog"

describe("generateSlug", () => {
    describe("existing behavior (backwards compatibility)", () => {
        it("generates slug from title without date when no date provided", () => {
            expect(generateSlug("My Blog Post Title")).toBe("my-blog-post-title")
        })

        it("handles special characters and spaces", () => {
            expect(generateSlug("Hello World! How are you?")).toBe("hello-world-how-are-you")
        })

        it("truncates long titles to 100 characters", () => {
            const longTitle = "a".repeat(150)
            const result = generateSlug(longTitle)
            expect(result.length).toBe(100)
            expect(result).toBe("a".repeat(100))
        })

        it("removes leading and trailing hyphens", () => {
            expect(generateSlug("---test-slug---")).toBe("test-slug")
        })

        it("handles empty strings", () => {
            expect(generateSlug("")).toBe("")
        })
    })

    describe("with date appended", () => {
        it("appends date in YYYY-MM-DD format", () => {
            const result = generateSlug("My Post", "2026-03-31")
            expect(result).toBe("my-post-2026-03-31")
        })

        it("handles date with existing hyphens in title", () => {
            const result = generateSlug("my-post-title", "2026-03-31")
            expect(result).toBe("my-post-title-2026-03-31")
        })

        it("truncates title portion to leave room for date (10 chars)", () => {
            const longTitle = "a".repeat(150)
            const result = generateSlug(longTitle, "2026-03-31")
            // Title portion: 89 chars (100 - 11 for "-YYYY-MM-DD")
            // Total: 89 + 1 + 10 = 100 chars
            expect(result.length).toBe(100)
            expect(result.endsWith("-2026-03-31")).toBe(true)
        })

        it("uses current date when date parameter is true", () => {
            const result = generateSlug("Test Post", true)
            const datePattern = /-\d{4}-\d{2}-\d{2}$/
            expect(datePattern.test(result)).toBe(true)
        })

        it("defaults to current date for new posts (true parameter)", () => {
            const result = generateSlug("New Post", true)
            const datePattern = /-\d{4}-\d{2}-\d{2}$/
            expect(datePattern.test(result)).toBe(true)
        })
    })
})

describe("estimateReadingTime", () => {
    it("calculates reading time based on 200 words per minute", () => {
        // Create content with exactly N words
        const words200 = Array(200).fill("word").join(" ")
        const words400 = Array(400).fill("word").join(" ")
        expect(estimateReadingTime(words200)).toBe(1)
        expect(estimateReadingTime(words400)).toBe(2)
    })

    it("returns minimum of 1 minute", () => {
        expect(estimateReadingTime("")).toBe(1)
        expect(estimateReadingTime("short")).toBe(1)
    })
})
