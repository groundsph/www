import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import {
    normalizeBaseUrl,
    extractModelIds,
    listModels,
    generateExcerpt,
    checkBlogPost,
} from "@/utils/ai/openai-compatible"

describe("openai-compatible helpers", () => {
    it("normalizes base URL", () => {
        expect(normalizeBaseUrl("https://example.com/")).toBe("https://example.com")
        expect(normalizeBaseUrl("https://example.com")).toBe("https://example.com")
        expect(normalizeBaseUrl("https://example.com/api/")).toBe("https://example.com/api")
    })

    it("extracts model ids from API payload", () => {
        const data = { data: [{ id: "model-a" }, { id: "model-b" }] }
        expect(extractModelIds(data)).toEqual(["model-a", "model-b"])
    })

    it("extracts model ids from empty payload", () => {
        expect(extractModelIds({})).toEqual([])
        expect(extractModelIds({ data: [] })).toEqual([])
    })
})

describe("listModels", () => {
    let originalEnv: { [key: string]: string | undefined }

    beforeEach(() => {
        originalEnv = {
            OPENAI_COMPATIBLE_BASE_URL: process.env.OPENAI_COMPATIBLE_BASE_URL,
            OPENAI_COMPATIBLE_API_KEY: process.env.OPENAI_COMPATIBLE_API_KEY,
        }
        process.env.OPENAI_COMPATIBLE_BASE_URL = "https://api.example.com"
        process.env.OPENAI_COMPATIBLE_API_KEY = "test-api-key"
    })

    afterEach(() => {
        Object.assign(process.env, originalEnv)
    })

    it("returns list of model ids on success", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    data: [{ id: "gpt-4" }, { id: "gpt-3.5-turbo" }],
                }),
            } as Response),
        )
        global.fetch = mockFetch

        const models = await listModels()

        expect(models).toEqual(["gpt-4", "gpt-3.5-turbo"])
        expect(mockFetch).toHaveBeenCalledTimes(1)
        expect(mockFetch.mock.calls[0][0]).toBe("https://api.example.com/v1/models")
        expect(mockFetch.mock.calls[0][1].signal).toBeDefined()
    })

    it("throws error when environment variables are missing", async () => {
        process.env.OPENAI_COMPATIBLE_BASE_URL = ""
        process.env.OPENAI_COMPATIBLE_API_KEY = ""

        expect(listModels()).rejects.toThrow("Missing OPENAI_COMPATIBLE_BASE_URL")
    })

    it("throws error when API returns non-ok response", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: false,
                status: 401,
                statusText: "Unauthorized",
            } as Response),
        )
        global.fetch = mockFetch

        expect(listModels()).rejects.toThrow("Failed to fetch models: 401 Unauthorized")
    })
})

describe("generateExcerpt", () => {
    let originalEnv: { [key: string]: string | undefined }

    beforeEach(() => {
        originalEnv = {
            OPENAI_COMPATIBLE_BASE_URL: process.env.OPENAI_COMPATIBLE_BASE_URL,
            OPENAI_COMPATIBLE_API_KEY: process.env.OPENAI_COMPATIBLE_API_KEY,
        }
        process.env.OPENAI_COMPATIBLE_BASE_URL = "https://api.example.com"
        process.env.OPENAI_COMPATIBLE_API_KEY = "test-api-key"
    })

    afterEach(() => {
        Object.assign(process.env, originalEnv)
    })

    it("returns generated excerpt on success", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: { content: "  This is a test excerpt.  " },
                    }],
                }),
            } as Response),
        )
        global.fetch = mockFetch

        const excerpt = await generateExcerpt("gpt-4", "This is blog content.")

        expect(excerpt).toBe("This is a test excerpt.")
        expect(mockFetch).toHaveBeenCalledTimes(1)
        expect(mockFetch.mock.calls[0][0]).toBe("https://api.example.com/v1/chat/completions")
        expect(mockFetch.mock.calls[0][1].signal).toBeDefined()
    })

    it("throws error when environment variables are missing", async () => {
        process.env.OPENAI_COMPATIBLE_BASE_URL = ""
        process.env.OPENAI_COMPATIBLE_API_KEY = ""

        expect(generateExcerpt("gpt-4", "content")).rejects.toThrow("Missing OPENAI_COMPATIBLE_BASE_URL")
    })

    it("throws error when API returns non-ok response", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: false,
                status: 429,
                statusText: "Rate Limited",
            } as Response),
        )
        global.fetch = mockFetch

        expect(generateExcerpt("gpt-4", "content")).rejects.toThrow("Failed to generate excerpt: 429 Rate Limited")
    })

    it("throws error when no excerpt is generated", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: "  " } }],
                }),
            } as Response),
        )
        global.fetch = mockFetch

        expect(generateExcerpt("gpt-4", "content")).rejects.toThrow("No excerpt generated")
    })

    it("throws error when choices are missing", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ choices: [] }),
            } as Response),
        )
        global.fetch = mockFetch

        expect(generateExcerpt("gpt-4", "content")).rejects.toThrow("No excerpt generated")
    })
})

describe("checkBlogPost", () => {
    let originalEnv: { [key: string]: string | undefined }

    beforeEach(() => {
        originalEnv = {
            OPENAI_COMPATIBLE_BASE_URL: process.env.OPENAI_COMPATIBLE_BASE_URL,
            OPENAI_COMPATIBLE_API_KEY: process.env.OPENAI_COMPATIBLE_API_KEY,
        }
        process.env.OPENAI_COMPATIBLE_BASE_URL = "https://api.example.com"
        process.env.OPENAI_COMPATIBLE_API_KEY = "test-api-key"
    })

    afterEach(() => {
        Object.assign(process.env, originalEnv)
    })

    it("returns parsed result on success", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                approved: true,
                                issues: [],
                                suggestions: ["Add more details"],
                            }),
                        },
                    }],
                }),
            } as Response),
        )
        global.fetch = mockFetch

        const result = await checkBlogPost("gpt-4", "This is blog content.")

        expect(result).toEqual({
            approved: true,
            issues: [],
            suggestions: ["Add more details"],
        })
        expect(mockFetch).toHaveBeenCalledTimes(1)
        expect(mockFetch.mock.calls[0][1].signal).toBeDefined()
    })

    it("throws error when environment variables are missing", async () => {
        process.env.OPENAI_COMPATIBLE_BASE_URL = ""
        process.env.OPENAI_COMPATIBLE_API_KEY = ""

        expect(checkBlogPost("gpt-4", "content")).rejects.toThrow("Missing OPENAI_COMPATIBLE_BASE_URL")
    })

    it("throws error when API returns non-ok response", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
            } as Response),
        )
        global.fetch = mockFetch

        expect(checkBlogPost("gpt-4", "content")).rejects.toThrow("Failed to check blog post: 500 Internal Server Error")
    })

    it("throws error when no response content is received", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: null } }],
                }),
            } as Response),
        )
        global.fetch = mockFetch

        expect(checkBlogPost("gpt-4", "content")).rejects.toThrow("No response from AI")
    })

    it("throws generic error when response format is invalid", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: {
                            content: JSON.stringify({ invalid: "format" }),
                        },
                    }],
                }),
            } as Response),
        )
        global.fetch = mockFetch

        expect(checkBlogPost("gpt-4", "content")).rejects.toThrow("Invalid AI response format")
    })

    it("throws generic error when response is not valid JSON", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: { content: "not valid json" },
                    }],
                }),
            } as Response),
        )
        global.fetch = mockFetch

        expect(checkBlogPost("gpt-4", "content")).rejects.toThrow("Invalid AI response format")
    })
})
