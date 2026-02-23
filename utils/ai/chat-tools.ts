import { runCafeQuery } from "@/utils/ai/tools/cafe-query-runner"
import {
    getCafeBySlug,
    compareCafes,
    listCitiesWithCounts,
    getNearbyCafes,
    getTopRatedCafes,
} from "@/utils/ai/tools/cafe-insights"
import { CafeQueryInput } from "@/utils/ai/tools/cafe-query"
import { GeoPoint } from "@/utils/ai/tools/cafe-geo"
import { chatCompletionWithTools } from "@/utils/ai/openai-compatible"
import { buildChatCafeCards } from "@/utils/ai/chat-cafe-cards"
import { buildChatCrawlDraft } from "@/utils/ai/chat-crawl-draft"
import { getGroundsInfo } from "@/utils/ai/grounds-info"
import type { ChatCafeCard, ChatCardContext, ChatCrawlDraft, ChatContext } from "@/utils/types/chat"

const MAX_TOOL_CALLS_DEFAULT = 6
const MAX_TOOL_CALLS_LIMIT = 8

const CHAT_SYSTEM_PROMPT = `You are a helpful assistant for Grounds, a coffee discovery platform for the Philippines.

You have access to tools for querying cafe information. When a user asks about cafes, use the appropriate tool.

Available tools:
- query_cafes: Search and filter cafes by location, amenities, ratings, etc.
- get_cafe_by_slug: Get detailed information about a specific cafe by its slug
- compare_cafes: Compare two cafes side by side
- list_cities: List all cities with cafe counts
- get_nearby_cafes: Find cafes near a specific location
- get_top_rated: Get top rated cafes in a city

Rules:
1. Always use tools when the user asks for specific cafe information
2. If a location is mentioned (e.g., "Cebu", "Manila"), use query_cafes with the city filter
3. If the user asks for "top" or "best" cafes, use get_top_rated or sort by rating
4. If the user asks for cafes "near" a location, use get_nearby_cafes
5. Provide concise, helpful responses based on the tool results
6. If no cafes match the query, politely inform the user
7. When you have enough data, respond with a final answer and do not call more tools.
8. If you render tables, use proper Markdown tables with each row on its own line. If you cannot format a table, use bullet points instead.`

export interface ChatToolResult {
    message: string
    cafes?: ChatCafeCard[]
    cardContext?: ChatCardContext
    toolCalls?: ToolCallRecord[]
    crawlDraft?: ChatCrawlDraft
    debug?: {
        maxCalls: number
        callCount: number
        reason?: "no_response" | "max_tool_calls" | "error"
        lastAssistantContent?: string | null
        toolCalls?: {
            toolName: string
            params: unknown
        }[]
    }
}

export interface ToolCallRecord {
    toolName: string
    params: unknown
    result: unknown
}

export interface RunChatOptions {
    message: string
    sessionId: string
    maxToolCalls?: number
    context?: ChatContext
}

interface ToolDefinition {
    type: "function"
    function: {
        name: string
        description: string
        parameters: object
    }
}

export const AVAILABLE_TOOLS: ToolDefinition[] = [
    {
        type: "function",
        function: {
            name: "query_cafes",
            description: "Search and filter cafes by location, amenities, ratings, and other criteria",
            parameters: {
                type: "object",
                properties: {
                    city: { type: "string", description: "City or municipality name" },
                    province: { type: "string", description: "Province name" },
                    region: { type: "string", description: "Region name" },
                    area: { type: "string", description: "Area or neighborhood" },
                    limit: { type: "number", description: "Maximum number of results (max 50)" },
                    offset: { type: "number", description: "Offset for pagination" },
                    sortBy: { type: "string", enum: ["rating", "distance", "recent", "reviews"], description: "Sort order" },
                    hasWifi: { type: "boolean", description: "Filter for cafes with WiFi" },
                    hasSockets: { type: "boolean", description: "Filter for cafes with power sockets" },
                    hasAircon: { type: "boolean", description: "Filter for cafes with air conditioning" },
                    isPetFriendly: { type: "boolean", description: "Filter for pet-friendly cafes" },
                    isWorkFriendly: { type: "boolean", description: "Filter for work-friendly cafes" },
                    servesFood: { type: "boolean", description: "Filter for cafes that serve food" },
                    hasOutdoorSeating: { type: "boolean", description: "Filter for cafes with outdoor seating" },
                    priceLevel: { type: "string", enum: ["low", "medium", "high"], description: "Price level filter" },
                    coffeeStyle: { type: "string", enum: ["classic", "artisan"], description: "Coffee style filter" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_cafe_by_slug",
            description: "Get detailed information about a specific cafe by its slug identifier",
            parameters: {
                type: "object",
                properties: {
                    slug: { type: "string", description: "The cafe's unique slug identifier" },
                },
                required: ["slug"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "compare_cafes",
            description: "Compare two cafes side by side",
            parameters: {
                type: "object",
                properties: {
                    slugA: { type: "string", description: "Slug of the first cafe" },
                    slugB: { type: "string", description: "Slug of the second cafe" },
                },
                required: ["slugA", "slugB"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_cities",
            description: "List all cities with their cafe counts, ordered by count descending",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "get_nearby_cafes",
            description: "Find cafes near a specific geographic location",
            parameters: {
                type: "object",
                properties: {
                    lat: { type: "number", description: "Latitude coordinate" },
                    lng: { type: "number", description: "Longitude coordinate" },
                    radiusKm: { type: "number", description: "Search radius in kilometers (max 50)" },
                },
                required: ["lat", "lng", "radiusKm"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_top_rated",
            description: "Get top rated cafes in a specific city",
            parameters: {
                type: "object",
                properties: {
                    city: { type: "string", description: "City name" },
                    limit: { type: "number", description: "Number of cafes to return (default 10)" },
                },
                required: ["city"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_grounds_info",
            description: "Return general information about Grounds.ph features and how to use the platform",
            parameters: { type: "object", properties: {} },
        },
    },
]

interface ToolCall {
    id: string
    type: "function"
    function: {
        name: string
        arguments: string
    }
}

interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool"
    content: string
    tool_calls?: ToolCall[]
    tool_call_id?: string
    name?: string
}

async function executeTool(toolName: string, args: string): Promise<unknown> {
    const parsed = JSON.parse(args)

    switch (toolName) {
        case "query_cafes": {
            const result = await runCafeQuery(parsed as CafeQueryInput)
            return result
        }
        case "get_cafe_by_slug": {
            const result = await getCafeBySlug(parsed.slug as string)
            return result
        }
        case "compare_cafes": {
            const result = await compareCafes(parsed.slugA as string, parsed.slugB as string)
            return result
        }
        case "list_cities": {
            const result = await listCitiesWithCounts()
            return result
        }
        case "get_nearby_cafes": {
            const latLng: GeoPoint = { lat: parsed.lat, lng: parsed.lng }
            const result = await getNearbyCafes(latLng, parsed.radiusKm as number)
            return result
        }
        case "get_top_rated": {
            const result = await getTopRatedCafes(parsed.city as string, parsed.limit ?? 10)
            return result
        }
        case "get_grounds_info": {
            return getGroundsInfo()
        }
        default:
            throw new Error(`Unknown tool: ${toolName}`)
    }
}

function validateMaxToolCalls(max?: number): number {
    if (max === undefined) return MAX_TOOL_CALLS_DEFAULT
    if (max < 1) return 1
    if (max > MAX_TOOL_CALLS_LIMIT) return MAX_TOOL_CALLS_LIMIT
    return max
}

function buildFallbackResponse(): ChatToolResult {
    return {
        message: "I'm having trouble processing your request right now. Please try again or rephrase your question.",
    }
}

function shouldForceCafeTool(text: string): boolean {
    const query = text.toLowerCase()
    return query.includes("cafe") || query.includes("cafes") || query.includes("near me") || query.includes("nearby") || query.includes("crawl")
}

function shouldForceCityQuery(text: string): string | null {
    const match = text.match(/\b(build|make|create|plan|design)?\s*(me\s*)?(a\s*)?(crawl|route|trail)\s*(for|in)?\s*([A-Za-z\s]+)?/i)
    if (match && match[6]) {
        const city = match[6].trim()
        if (city.length > 2) return city
    }
    return null
}

export async function runChatWithTools(options: RunChatOptions): Promise<ChatToolResult> {
    const { message, sessionId, maxToolCalls, context } = options

    if (!message?.trim()) {
        return {
            message: "Please enter a message to start the conversation.",
        }
    }

    const maxCalls = validateMaxToolCalls(maxToolCalls)
    const messages: ChatMessage[] = [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        { role: "user", content: message },
    ]
    const toolCallRecords: ToolCallRecord[] = []
    const debugEnabled = process.env.CHAT_DEBUG === "true"
    let lastAssistantContent: string | null = null
    let callCount = 0

    const buildDebug = (reason?: "no_response" | "max_tool_calls" | "error", countOverride?: number) => {
        if (!debugEnabled) return undefined
        return {
            maxCalls,
            callCount: countOverride ?? callCount,
            reason,
            lastAssistantContent,
            toolCalls: toolCallRecords.map(({ toolName, params }) => ({ toolName, params })),
        }
    }

    try {
        const contextCrawlDraft = await buildChatCrawlDraft(toolCallRecords, message, context)
        if (contextCrawlDraft) {
            return {
                message: `Built a crawl from your previous list. ${contextCrawlDraft.description}`,
                crawlDraft: contextCrawlDraft,
                toolCalls: toolCallRecords.length > 0 ? toolCallRecords : undefined,
                debug: buildDebug(undefined, callCount),
            }
        }

        for (callCount = 0; callCount < maxCalls; callCount++) {
            const forcedCity = shouldForceCityQuery(message)
            if (forcedCity && callCount === 0) {
                const result = await executeTool("query_cafes", JSON.stringify({ city: forcedCity }))
                toolCallRecords.push({ toolName: "query_cafes", params: { city: forcedCity }, result })
                break
            }

            const response = await chatCompletionWithTools(messages, AVAILABLE_TOOLS, {
                temperature: 0.7,
                maxTokens: 1000,
                timeoutMs: 60000, // 60 seconds for longer queries
                toolChoice: shouldForceCafeTool(message) ? { type: "function", function: { name: "query_cafes" } } : "auto",
            })

            if (!response) {
                return {
                    ...buildFallbackResponse(),
                    debug: buildDebug("no_response", callCount + 1),
                }
            }

            const assistantMessage: ChatMessage = {
                role: "assistant",
                content: response.content ?? "",
            }
            lastAssistantContent = response.content ?? null

            if (response.toolCalls && response.toolCalls.length > 0) {
                assistantMessage.tool_calls = response.toolCalls
                messages.push(assistantMessage)

                for (const toolCall of response.toolCalls) {
                    try {
                        const result = await executeTool(toolCall.function.name, toolCall.function.arguments)
                        toolCallRecords.push({
                            toolName: toolCall.function.name,
                            params: JSON.parse(toolCall.function.arguments),
                            result,
                        })

                        messages.push({
                            role: "tool",
                            content: JSON.stringify(result),
                            tool_call_id: toolCall.id,
                            name: toolCall.function.name,
                        })
                    } catch (toolError) {
                        console.error(`Tool execution error for ${toolCall.function.name}:`, toolError)
                        toolCallRecords.push({
                            toolName: toolCall.function.name,
                            params: JSON.parse(toolCall.function.arguments),
                            result: { error: "Tool execution failed" },
                        })
                        messages.push({
                            role: "tool",
                            content: JSON.stringify({ error: "Tool execution failed" }),
                            tool_call_id: toolCall.id,
                            name: toolCall.function.name,
                        })
                    }
                }
            } else {
                messages.push(assistantMessage)
                const { cafes, cardContext } = buildChatCafeCards(toolCallRecords)
                const crawlDraft = await buildChatCrawlDraft(toolCallRecords, message, context)
                return {
                    message: response.content ?? "I don't have a response for that.",
                    cafes,
                    cardContext,
                    ...(crawlDraft ? { crawlDraft } : {}),
                    toolCalls: toolCallRecords.length > 0 ? toolCallRecords : undefined,
                    debug: buildDebug(undefined, callCount + 1),
                }
            }
        }

        const { cafes, cardContext } = buildChatCafeCards(toolCallRecords)
        const crawlDraft = await buildChatCrawlDraft(toolCallRecords, message, context)
        return {
            message: "I needed to look up more information than expected. Here's what I found so far.",
            cafes,
            cardContext,
            ...(crawlDraft ? { crawlDraft } : {}),
            toolCalls: toolCallRecords.length > 0 ? toolCallRecords : undefined,
            debug: buildDebug("max_tool_calls", maxCalls),
        }
    } catch (error) {
        console.error(`Chat error for session ${sessionId}:`, error)
        return {
            ...buildFallbackResponse(),
            debug: buildDebug("error", callCount),
        }
    }
}
