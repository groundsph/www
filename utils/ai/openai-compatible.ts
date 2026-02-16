import { z } from "zod"

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
    model: string,
    content: string,
): Promise<string> {
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
                    content: EXCERPT_SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: `Generate an excerpt for this blog post:\n\n${content}`,
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
