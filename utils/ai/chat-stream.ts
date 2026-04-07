"use server"

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
import type { ChatStreamChunk, ChatContext } from "@/utils/types/chat"

const MAX_TOOL_CALLS = 6

const CHAT_SYSTEM_PROMPT = `You are a helpful assistant for Grounds, a coffee discovery platform for the Philippines.

You have access to tools for querying cafe information. When a user asks about cafes, use the appropriate tool.

Available tools:
- query_cafes: Search and filter cafes by location, amenities, ratings, etc.
- get_cafe_by_slug: Get detailed information about a specific cafe by its slug
- compare_cafes: Compare two cafes side by side
- list_cities: List all cities with cafe counts
- get_nearby_cafes: Find cafes near a specific location
- get_top_rated: Get top rated cafes in a city
- get_grounds_info: Return general information about Grounds.ph features and how to use the platform

Rules:
1. Always use tools when the user asks for specific cafe information
2. If a location is mentioned (e.g., "Cebu", "Manila"), use query_cafes with the city filter
3. If the user asks for "top" or "best" cafes, use get_top_rated or sort by rating
4. If the user asks for cafes "near" a location, use get_nearby_cafes
5. Use get_grounds_info for questions about Grounds.ph platform, features, or how to use the site
6. Ask clarifying questions if day/time or start location is missing for crawl requests
7. Provide concise, helpful responses based on the tool results
8. If no cafes match the query, politely inform the user
9. When you have enough data, respond with a final answer and do not call more tools.
10. If the user refers to the previous list or says things like "from those" or "make a crawl from these", use the recent context rather than calling tools again.
11. If you render tables, use proper Markdown tables with each row on its own line. If you cannot format a table, use bullet points instead.`

interface ToolDefinition {
    type: "function"
    function: {
        name: string
        description: string
        parameters: object
    }
}

const tools: ToolDefinition[] = [
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

export interface ChatStreamOptions {
    message: string
    sessionId: string
    context?: ChatContext
    onChunk: (chunk: ChatStreamChunk) => void | Promise<void>
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

function shouldForceCityQuery(text: string): string | null {
    // Don't force city query if user is asking for nearby/near me
    const nearbyKeywords = ["near me", "nearby", "closest", "around me"]
    const isNearbyQuery = nearbyKeywords.some(kw => text.toLowerCase().includes(kw))
    if (isNearbyQuery) return null
    
    const match = text.match(/\b(build|make|create|plan|design)?\s*(me\s*)?(a\s*)?(crawl|route|trail)\s*(for|in)\s+([A-Za-z\s]{3,})/i)
    if (match && match[6]) {
        const city = match[6].trim()
        // Validate it looks like a city name (starts with capital, no small words)
        if (city.length > 2 && /^[A-Z][a-z]+$/.test(city.split(/\s+/)[0])) {
            return city
        }
    }
    return null
}

function stripLocationHint(text: string): string {
    return text.replace(/\n\nUser location[\s\S]*$/i, "").trim()
}

export async function runChatStream(options: ChatStreamOptions): Promise<void> {
    const { message, sessionId, onChunk } = options

    if (!message?.trim()) {
        await onChunk({ type: "error", error: "Please enter a message" })
        return
    }

    await onChunk({ type: "progress", message: "Thinking...", step: 1 })

    const messages: ChatMessage[] = [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        { role: "user", content: message },
    ]

    const toolCallRecords: { toolName: string; params: unknown; result: unknown }[] = []

    const cleanedMessage = stripLocationHint(message)

    // Check for context-based crawl BEFORE any tool calls
    if (options.context?.recentCafes?.length && cleanedMessage.length > 0) {
        const contextCrawlDraft = await buildChatCrawlDraft([], cleanedMessage, options.context)
        if (contextCrawlDraft) {
            await onChunk({ type: "crawlDraft", crawlDraft: contextCrawlDraft })
            await onChunk({
                type: "complete",
                message: `Built a crawl from your previous list with ${contextCrawlDraft.items.length} stops. ${contextCrawlDraft.description}`,
            })
            return
        }
    }

    try {
        // Check for direct crawl query
        const forcedCity = shouldForceCityQuery(cleanedMessage)
        if (forcedCity) {
            await onChunk({ type: "progress", message: `Searching cafes in ${forcedCity}...`, step: 2 })
            
            const result = await runCafeQuery({ city: forcedCity })
            toolCallRecords.push({ toolName: "query_cafes", params: { city: forcedCity }, result })
            
            await onChunk({
                type: "tool",
                toolName: "query_cafes",
                params: { city: forcedCity },
            })

            const { cafes, cardContext } = buildChatCafeCards(toolCallRecords)
            const crawlDraft = await buildChatCrawlDraft(toolCallRecords, cleanedMessage, options.context)

            if (cafes.length > 0) {
                await onChunk({ type: "cafes", cafes, cardContext })
            }

            if (crawlDraft) {
                await onChunk({ type: "crawlDraft", crawlDraft })
            }

            const baseMessage = cafes.length > 0
                ? `I found ${cafes.length} cafes in ${forcedCity} for your crawl!`
                : `I couldn't find any cafes in ${forcedCity}. Want to try a nearby city or adjust filters?`
            const finalMessage = crawlDraft ? `${baseMessage} ${crawlDraft.description}` : baseMessage

            await onChunk({
                type: "complete",
                message: finalMessage,
            })
            return
        }

    // Normal tool-calling flow
    for (let callCount = 0; callCount < MAX_TOOL_CALLS; callCount++) {
            const response = await chatCompletionWithTools(messages, tools, {
                temperature: 0.7,
                maxTokens: 1000,
                timeoutMs: 60000,
                toolChoice: "auto",
            })

            if (!response) {
                await onChunk({ type: "error", error: "No response from AI" })
                return
            }

            const assistantMessage: ChatMessage = {
                role: "assistant",
                content: response.content ?? "",
            }

            if (response.toolCalls && response.toolCalls.length > 0) {
                assistantMessage.tool_calls = response.toolCalls
                messages.push(assistantMessage)

                for (const toolCall of response.toolCalls) {
                    await onChunk({
                        type: "progress",
                        message: `Searching ${toolCall.function.name}...`,
                        step: callCount + 2,
                    })

                    try {
                        const result = await executeTool(toolCall.function.name, toolCall.function.arguments)
                        toolCallRecords.push({
                            toolName: toolCall.function.name,
                            params: JSON.parse(toolCall.function.arguments),
                            result,
                        })

                        await onChunk({
                            type: "tool",
                            toolName: toolCall.function.name,
                            params: JSON.parse(toolCall.function.arguments),
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
                const crawlDraft = await buildChatCrawlDraft(toolCallRecords, cleanedMessage, options.context)

                if (cafes.length > 0) {
                    await onChunk({ type: "cafes", cafes, cardContext })
                }

                if (crawlDraft) {
                    await onChunk({ type: "crawlDraft", crawlDraft })
                }

                const baseMessage = response.content ?? "I don't have a response for that."
                const finalMessage = (cafes.length > 0 && crawlDraft)
                    ? `I found ${cafes.length} cafes for your crawl! ${crawlDraft.description}`
                    : baseMessage

                await onChunk({
                    type: "complete",
                    message: finalMessage,
                })
                return
            }
        }

        // Max tool calls reached
        const { cafes, cardContext } = buildChatCafeCards(toolCallRecords)
        const crawlDraft = await buildChatCrawlDraft(toolCallRecords, cleanedMessage, options.context)

        if (cafes.length > 0) {
            await onChunk({ type: "cafes", cafes, cardContext })
        }

        if (crawlDraft) {
            await onChunk({ type: "crawlDraft", crawlDraft })
        }

        const baseMessage = "I needed to look up more information than expected. Here's what I found so far."
        const finalMessage = (cafes.length > 0 && crawlDraft)
            ? `I found ${cafes.length} cafes for your crawl! ${crawlDraft.description}`
            : baseMessage

        await onChunk({
            type: "complete",
            message: finalMessage,
        })
    } catch (error) {
        console.error(`Chat error for session ${sessionId}:`, error)
        await onChunk({
            type: "error",
            error: "An error occurred while processing your message",
        })
    }
}
