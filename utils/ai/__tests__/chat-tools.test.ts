import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { AVAILABLE_TOOLS } from "@/utils/ai/chat-tools"

interface MockCafe {
    id?: unknown
    name?: unknown
    slug?: unknown
    thumbnail?: unknown
    cityMunicipality?: unknown
    region?: unknown
    lat?: unknown
    lng?: unknown
}

describe("chat tools", () => {
    it("includes get_grounds_info tool", () => {
        const toolNames = AVAILABLE_TOOLS.map((t) => t.function.name)
        expect(toolNames).toContain("get_grounds_info")
    })
})

// Mock database with chainable query builder
function createMockQueryBuilder(results: unknown[] = []) {
    const self = {
        from: () => self,
        leftJoin: () => self,
        where: () => self,
        and: () => self,
        orderBy: () => self,
        limit: () => self,
        offset: () => self,
        groupBy: () => self,
        then: (resolve: (value: unknown[]) => unknown, reject?: (reason?: unknown) => unknown) => {
            return Promise.resolve(results).then(resolve, reject)
        },
        [Symbol.asyncIterator]: async function* () {
            for (const item of results) {
                yield item
            }
        },
    }
    return self
}

// Mock database module
mock.module("@/db", () => ({
    db: {
        select: () => createMockQueryBuilder([]),
    },
}))

// Mock buildChatCrawlDraft to return a draft when message contains "crawl"
mock.module("@/utils/ai/chat-crawl-draft", () => ({
    buildChatCrawlDraft: (records: { params?: { city?: string; province?: string; region?: string }; result?: { cafes?: unknown[] } }[], message: string) => {
        if (message.toLowerCase().includes("crawl")) {
            const params = records[0]?.params
            const result = records[0]?.result
            const location = params?.city || params?.province || params?.region || "Custom"
            const cafes = result?.cafes || []
            return {
                title: `${location} Coffee Crawl`,
                description: "Draft",
                isPublic: false,
                items: cafes.map((cafe: MockCafe, index: number) => ({
                    cafeId: String(cafe.id || ""),
                    name: String(cafe.name || ""),
                    slug: String(cafe.slug || ""),
                    thumbnail: cafe.thumbnail || null,
                    cityMunicipality: cafe.cityMunicipality || null,
                    region: cafe.region || null,
                    lat: cafe.lat || null,
                    lng: cafe.lng || null,
                    sortOrder: index,
                    note: null,
                })),
            }
        }
        return null
    },
}))

// Import after mocking
const { runChatWithTools } = await import("@/utils/ai/chat-tools")

describe("runChatWithTools", () => {
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

    it("runs tool call and returns response", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        choices: [
                            {
                                message: {
                                    content: "Here are some great cafes in Cebu!",
                                },
                            },
                        ],
                    }),
            } as Response)
        )
        global.fetch = mockFetch

        const result = await runChatWithTools({
            message: "Top cafes in Cebu",
            sessionId: "test",
        })
        expect(result.message.length).toBeGreaterThan(0)
        expect(result.message).toBe("Here are some great cafes in Cebu!")
    })

    it("handles tool calling loop", async () => {
        let callCount = 0
        const mockFetch = mock(() => {
            callCount++
            if (callCount === 1) {
                // First call: AI requests tool
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            choices: [
                                {
                                    message: {
                                        content: null,
                                        tool_calls: [
                                            {
                                                id: "call_1",
                                                type: "function",
                                                function: {
                                                    name: "list_cities",
                                                    arguments: "{}",
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        }),
                } as Response)
            }
            // Second call: AI returns final response
            return Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        choices: [
                            {
                                message: {
                                    content: "Here are the cities with cafes!",
                                },
                            },
                        ],
                    }),
            } as Response)
        })
        global.fetch = mockFetch

        const result = await runChatWithTools({
            message: "List cities",
            sessionId: "test-loop",
        })
        expect(result.message.length).toBeGreaterThan(0)
        expect(callCount).toBe(2)
        // Tool calls are tracked even if DB fails
        expect(result.toolCalls).toBeDefined()
        expect(result.toolCalls?.length).toBeGreaterThan(0)
    })

    it("handles empty message gracefully", async () => {
        const result = await runChatWithTools({
            message: "",
            sessionId: "test-error",
        })
        expect(result.message.length).toBeGreaterThan(0)
        expect(result.message).toBe("Please enter a message to start the conversation.")
    })

    it("handles API errors gracefully", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
            } as Response)
        )
        global.fetch = mockFetch

        const result = await runChatWithTools({
            message: "Top cafes in Cebu",
            sessionId: "test-api-error",
        })
        expect(result.message.length).toBeGreaterThan(0)
        expect(result.message).toContain("having trouble")
    })

    it("respects max tool call limit", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        choices: [
                            {
                                message: {
                                    content: null,
                                    tool_calls: [
                                        {
                                            id: "call_1",
                                            type: "function",
                                            function: {
                                                name: "list_cities",
                                                arguments: "{}",
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    }),
            } as Response)
        )
        global.fetch = mockFetch

        const result = await runChatWithTools({
            message: "List cities",
            sessionId: "test-limit",
            maxToolCalls: 2,
        })
        expect(result.message.length).toBeGreaterThan(0)
        expect(result.toolCalls).toBeDefined()
        // Should have hit the limit (2 calls max means 2 tool calls)
        expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it("handles missing environment variables", async () => {
        process.env.OPENAI_COMPATIBLE_BASE_URL = ""
        process.env.OPENAI_COMPATIBLE_API_KEY = ""

        const result = await runChatWithTools({
            message: "Top cafes in Cebu",
            sessionId: "test-missing-env",
        })
        expect(result.message.length).toBeGreaterThan(0)
        expect(result.message).toContain("having trouble")
    })

    it("handles multiple tool calls in single response", async () => {
        let callCount = 0
        const mockFetch = mock(() => {
            callCount++
            if (callCount === 1) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            choices: [
                                {
                                    message: {
                                        content: null,
                                        tool_calls: [
                                            {
                                                id: "call_1",
                                                type: "function",
                                                function: {
                                                    name: "list_cities",
                                                    arguments: "{}",
                                                },
                                            },
                                            {
                                                id: "call_2",
                                                type: "function",
                                                function: {
                                                    name: "get_top_rated",
                                                    arguments: JSON.stringify({ city: "Cebu", limit: 5 }),
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        }),
                } as Response)
            }
            return Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        choices: [
                            {
                                message: {
                                    content: "Found info for you!",
                                },
                            },
                        ],
                    }),
            } as Response)
        })
        global.fetch = mockFetch

        const result = await runChatWithTools({
            message: "What cities have cafes and what's the best in Cebu?",
            sessionId: "test-multi",
        })
        expect(result.message.length).toBeGreaterThan(0)
        expect(result.toolCalls?.length).toBe(2)
    })

    it("returns cafes when tool calls resolve", async () => {
        let callCount = 0
        const mockFetch = mock(() => {
            callCount++
            if (callCount === 1) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            choices: [
                                {
                                    message: {
                                        content: null,
                                        tool_calls: [
                                            {
                                                id: "call_1",
                                                type: "function",
                                                function: {
                                                    name: "list_cities",
                                                    arguments: "{}",
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        }),
                } as Response)
            }
            return Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        choices: [
                            {
                                message: {
                                    content: "Here are the cities!",
                                },
                            },
                        ],
                    }),
            } as Response)
        })
        global.fetch = mockFetch

        const result = await runChatWithTools({
            message: "List cities",
            sessionId: "test-cards",
        })
        expect(result.cafes).toBeDefined()
    })

    it("returns crawlDraft when builder provides one", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        choices: [{ message: { content: "Here you go" } }],
                    }),
            } as Response)
        )
        global.fetch = mockFetch

        const result = await runChatWithTools({
            message: "Build a crawl",
            sessionId: "test",
        })

        expect(result.crawlDraft).toBeDefined()
    })
})
