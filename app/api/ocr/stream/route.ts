import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/db"
import { cafeMenuItems, cafes } from "@/db/schema/tables"
import { eq } from "drizzle-orm"
import { parseOcrMenuItems, MENU_EXTRACTION_SYSTEM_PROMPT, resolveImageMime } from "@/utils/ai/menu-ocr"
import { buildChatCompletionsUrl, sanitizeUpstreamError } from "@/utils/ai/openai-compatible"
import { deduplicateMenuItems } from "@/app/api/actions/menu-ocr"
import { z } from "zod"

const requestSchema = z.object({
    cafeId: z.string().min(1),
    imageBase64: z.string().min(1),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]).optional(),
})

function getConfig() {
    const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL ?? ""
    const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY ?? ""
    return { baseUrl, apiKey }
}


export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const validated = requestSchema.safeParse(body)
        if (!validated.success) {
            return new Response(
                JSON.stringify({ type: "error", error: "Invalid request" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            )
        }

        const user = await getCurrentUser()
        if (!user) {
            return new Response(
                JSON.stringify({ type: "error", error: "Authentication required" }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            )
        }

        const cafe = await db.query.cafes.findFirst({
            where: eq(cafes.id, validated.data.cafeId),
        })

        if (!cafe) {
            return new Response(
                JSON.stringify({ type: "error", error: "Cafe not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            )
        }

        const { baseUrl, apiKey } = getConfig()
        if (!baseUrl || !apiKey) {
            return new Response(
                JSON.stringify({ type: "error", error: "AI service not configured" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            )
        }

        const normalizedUrl = buildChatCompletionsUrl(baseUrl)
        const model = process.env.OPENAI_COMPATIBLE_OCR_MODEL ?? "gpt-4o"

        const ocrResponse = await fetch(normalizedUrl, {
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
                        content: MENU_EXTRACTION_SYSTEM_PROMPT,
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${resolveImageMime(validated.data.mimeType)};base64,${validated.data.imageBase64}`,
                                    detail: "low",
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 4096,
                temperature: 0.3,
                stream: true,
            }),
            signal: AbortSignal.timeout(180000),
        })

        if (!ocrResponse.ok) {
            const upstreamBody = await ocrResponse.text().catch(() => "")
            const detail = sanitizeUpstreamError(ocrResponse.status, ocrResponse.statusText, upstreamBody)
            console.error(`OCR upstream error: ${detail} (url: ${normalizedUrl})`)
            return new Response(
                JSON.stringify({ type: "error", error: `AI service error: ${detail}` }),
                { status: 502, headers: { "Content-Type": "application/json" } }
            )
        }

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder()
                let accumulated = ""
                let firstTokenReceived = false

                const send = (data: Record<string, unknown>) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
                }

                try {
                    send({ type: "status", message: "Image sent to AI" })

                    const reader = ocrResponse.body?.getReader()
                    if (!reader) {
                        send({ type: "error", error: "No response stream" })
                        controller.close()
                        return
                    }

                    const decoder = new TextDecoder()
                    let buffer = ""

                    send({ type: "status", message: "AI analyzing menu..." })

                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break

                        buffer += decoder.decode(value, { stream: true })
                        const lines = buffer.split("\n")
                        buffer = lines.pop() ?? ""

                        for (const line of lines) {
                            const trimmed = line.trim()
                            if (!trimmed || !trimmed.startsWith("data: ")) continue

                            const data = trimmed.slice(6)
                            if (data === "[DONE]") continue

                            try {
                                const parsed = JSON.parse(data)
                                const content = parsed.choices?.[0]?.delta?.content

                                if (content) {
                                    if (!firstTokenReceived) {
                                        firstTokenReceived = true
                                        send({ type: "status", message: "Extracting items..." })
                                    }
                                    accumulated += content
                                    send({ type: "content", token: content })
                                }
                            } catch {
                                // Skip unparseable lines
                            }
                        }
                    }

                    send({ type: "status", message: "Processing results..." })

                    const items = parseOcrMenuItems(accumulated)

                    const existingItems = await db
                        .select({
                            name: cafeMenuItems.name,
                            category: cafeMenuItems.category,
                            price: cafeMenuItems.price,
                        })
                        .from(cafeMenuItems)
                        .where(eq(cafeMenuItems.cafeId, validated.data.cafeId))

                    const deduplicated = await deduplicateMenuItems(items, existingItems)
                    const duplicateNames = items
                        .filter((item) => !deduplicated.some((d) => d.name === item.name))
                        .map((item) => item.name)

                    send({
                        type: "complete",
                        items,
                        deduplicated,
                        duplicates: duplicateNames,
                    })
                } catch (error) {
                    console.error("OCR stream error:", error)
                    send({
                        type: "error",
                        error: error instanceof Error ? error.message : "OCR processing failed",
                    })
                } finally {
                    controller.close()
                }
            },
        })

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        })
    } catch (error) {
        console.error("OCR API error:", error)
        return new Response(
            JSON.stringify({ type: "error", error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        )
    }
}
