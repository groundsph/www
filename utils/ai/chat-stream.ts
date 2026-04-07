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
import { CHAT_SYSTEM_PROMPT, CHAT_TOOLS } from "@/utils/ai/tool-definitions"
import type { ChatStreamChunk, ChatContext } from "@/utils/types/chat"

const MAX_TOOL_CALLS = 6

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
        case "get_cafe_reviews": {
            const { getCafeReviews } = await import("@/utils/ai/tools/cafe-reviews")
            return await getCafeReviews(parsed.slug as string, parsed.limit ?? 5)
        }
        case "get_cafe_menu": {
            const { getCafeMenu } = await import("@/utils/ai/tools/cafe-menu")
            return await getCafeMenu(parsed.slug as string, parsed.category)
        }
        case "get_cafe_hours": {
            const { getCafeHours } = await import("@/utils/ai/tools/cafe-hours")
            return await getCafeHours(parsed.slug as string)
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
            const response = await chatCompletionWithTools(messages, CHAT_TOOLS, {
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
