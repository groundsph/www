import { z } from "zod"
import type { ToolDefinition } from "@/utils/ai/tool-definitions"

const blogCheckSchema = z.object({
    approved: z.boolean(),
    issues: z.array(z.string()),
    suggestions: z.array(z.string()),
})

export type BlogCheckResult = z.infer<typeof blogCheckSchema>

const EXCERPT_SYSTEM_PROMPT =
    "You are a helpful assistant. Generate a concise 2-3 sentence excerpt summarizing the following blog post content."

const BLOG_CHECK_SYSTEM_PROMPT = `You are a content moderator. Review blog posts for quality and policy compliance.
Respond with a JSON object containing:
- approved: boolean (true if the post meets quality standards)
- issues: array of strings (any problems found)
- suggestions: array of strings (improvements to consider)`

function getConfig() {
    const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL ?? ""
    const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY ?? ""
    return { baseUrl, apiKey }
}

export function normalizeBaseUrl(url: string): string {
    return url.replace(/\/$/, "")
}

export function extractModelIds(payload: { data?: { id: string }[] }): string[] {
    return (payload.data ?? []).map((m) => m.id)
}

export async function listModels(): Promise<string[]> {
    const { baseUrl, apiKey } = getConfig()
    if (!baseUrl || !apiKey) {
        throw new Error("Missing OPENAI_COMPATIBLE_BASE_URL or OPENAI_COMPATIBLE_API_KEY")
    }

    const normalizedUrl = normalizeBaseUrl(baseUrl)
    const response = await fetch(`${normalizedUrl}/v1/models`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as { data?: { id: string }[] }
    return extractModelIds(data)
}

export async function generateExcerpt(
    content: string,
    model?: string,
): Promise<string> {
    const { baseUrl, apiKey } = getConfig()
    if (!baseUrl || !apiKey) {
        throw new Error("Missing OPENAI_COMPATIBLE_BASE_URL or OPENAI_COMPATIBLE_API_KEY")
    }

    const effectiveModel = model ?? getExcerptModel()

    const normalizedUrl = normalizeBaseUrl(baseUrl)
    const response = await fetch(`${normalizedUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: effectiveModel,
            messages: [
                {
                    role: "system",
                    content: EXCERPT_SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: `Generate an excerpt for this blog post with max length of 250 characters:\n\n${content}`,
                },
            ],
            max_tokens: 150,
            temperature: 0.7,
        }),
        signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
        throw new Error(`Failed to generate excerpt: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[]
    }

    const excerpt = data.choices?.[0]?.message?.content?.trim()
    if (!excerpt) {
        throw new Error("No excerpt generated")
    }

    return excerpt
}

export async function checkBlogPost(
    model: string,
    content: string,
): Promise<BlogCheckResult> {
    const { baseUrl, apiKey } = getConfig()
    if (!baseUrl || !apiKey) {
        throw new Error("Missing OPENAI_COMPATIBLE_BASE_URL or OPENAI_COMPATIBLE_API_KEY")
    }

    const normalizedUrl = normalizeBaseUrl(baseUrl)
    const response = await fetch(`${normalizedUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "system",
                    content: BLOG_CHECK_SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: `Review this blog post:\n\n${content}`,
                },
            ],
            max_tokens: 500,
            temperature: 0.3,
            response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
        throw new Error(`Failed to check blog post: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[]
    }

    const jsonContent = data.choices?.[0]?.message?.content
    if (!jsonContent) {
        throw new Error("No response from AI")
    }

    try {
        const parsed = JSON.parse(jsonContent)
        return blogCheckSchema.parse(parsed)
    } catch (error) {
        console.error("AI response validation failed:", error)
        throw new Error("Invalid AI response format")
    }
}

// Tool definitions and types for tool calling
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

export interface ChatCompletionResponse {
    content: string | null
    toolCalls: ToolCall[] | null
}

export interface ChatCompletionOptions {
    maxTokens?: number
    temperature?: number
    timeoutMs?: number
    toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } }
}

const DEFAULT_CHAT_MODEL = "gpt-4o-mini"
const DEFAULT_EXCERPT_MODEL = "gpt-4o-mini"

function getChatModel(): string {
    return process.env.OPENAI_COMPATIBLE_MODEL ?? DEFAULT_CHAT_MODEL
}

export function getExcerptModel(): string {
    return process.env.OPENAI_COMPATIBLE_EXCERPT_MODEL ?? DEFAULT_EXCERPT_MODEL
}

export function getChatModelDisplayName(): string {
    const model = getChatModel()
    // Map internal model names to user-friendly names
    const displayNames: Record<string, string> = {
        "qwen3.5:397b-cloud": "Qwen 3.5 (397B)",
        "gemma4:31b-cloud": "Gemma 4 (31B)",
        "gpt-4o-mini": "GPT-4o Mini",
        "gpt-4o": "GPT-4o",
    }
    return displayNames[model] ?? model
}

/**
 * Make a chat completion request with tool support
 */
export async function chatCompletionWithTools(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    options: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse | null> {
    const { baseUrl, apiKey } = getConfig()
    if (!baseUrl || !apiKey) {
        console.error("Missing OPENAI_COMPATIBLE_BASE_URL or OPENAI_COMPATIBLE_API_KEY")
        return null
    }

    const normalizedUrl = normalizeBaseUrl(baseUrl)
    const timeoutMs = options.timeoutMs ?? 30000

    try {
        const response = await fetch(`${normalizedUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: getChatModel(),
                messages,
                tools,
                tool_choice: options.toolChoice ?? "auto",
                max_tokens: options.maxTokens ?? 1000,
                temperature: options.temperature ?? 0.7,
                // Disable thinking/reasoning for chat. Thinking models like
                // qwen3.5 auto-enable reasoning by default, which eats the
                // token budget and can return an empty `content` for short
                // prompts (e.g. "Hello"). Per Ollama's OpenAI-compatible API,
                // `reasoning_effort: "none"` turns thinking off and returns the
                // final answer directly in `content`.
                reasoning_effort: "none",
            }),
            signal: AbortSignal.timeout(timeoutMs),
        })

        if (!response.ok) {
            console.error(`Chat completion failed: ${response.status} ${response.statusText}`)
            // Throw with the status so callers can surface a meaningful,
            // mappable error instead of a generic "no response".
            throw new Error(`Chat provider responded with ${response.status}`)
        }

        const data = (await response.json()) as {
            choices?: {
                message?: {
                    content?: string
                    reasoning_content?: string
                    thinking?: string
                    tool_calls?: ToolCall[]
                }
            }[]
        }

        const message = data.choices?.[0]?.message
        if (!message) {
            return null
        }

        // Strip any stray thinking tags that leak into content when a reasoning
        // model emits them despite reasoning being disabled, then fall back to
        // the reasoning trace only when the final answer is empty.
        const stripThinking = (text: string): string =>
            text.replace(/<[\s\S]*?<\/think>\s*/gi, "").trim()

        let content = message.content ? stripThinking(message.content) : ""
        const reasoningHint =
            message.reasoning_content ?? message.thinking ?? ""
        if (!content && reasoningHint.trim()) {
            content = stripThinking(reasoningHint)
        }

        return {
            content: content || null,
            toolCalls: message.tool_calls ?? null,
        }
    } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
            console.error("Chat completion timed out")
            throw new Error("The chat provider timed out")
        }
        // Re-throw our own status errors; swallow truly unexpected ones as null
        // to avoid leaking internal details to the client.
        if (error instanceof Error && error.message.startsWith("Chat provider")) {
            throw error
        }
        console.error("Chat completion error:", error)
        return null
    }
}
