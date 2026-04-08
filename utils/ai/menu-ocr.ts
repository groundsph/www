import { z } from "zod"

const priceSchema = z.union([
    z.number().nonnegative(),
    z.string().transform((val, ctx) => {
        const num = Number(val)
        if (isNaN(num) || num < 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Price must be a non-negative number",
            })
            return z.NEVER
        }
        return num
    }),
])

const ocrMenuItemSchema = z.object({
    name: z.string().min(1),
    category: z.string(),
    price: priceSchema,
    description: z.string().optional(),
    is_food: z.boolean().optional(),
    is_hot: z.boolean().optional(),
    is_cold: z.boolean().optional(),
})

export type OcrMenuItem = z.infer<typeof ocrMenuItemSchema>

function getConfig() {
    const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL ?? ""
    const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY ?? ""
    return { baseUrl, apiKey }
}

function normalizeBaseUrl(url: string): string {
    return url.replace(/\/$/, "")
}

function extractJsonFromMarkdown(text: string): string {
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonBlockMatch) {
        return jsonBlockMatch[1].trim()
    }
    const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch) {
        return codeBlockMatch[1].trim()
    }
    return text.trim()
}

export function parseOcrMenuItems(raw: string): OcrMenuItem[] {
    try {
        const cleaned = extractJsonFromMarkdown(raw)
        const parsed = JSON.parse(cleaned)
        if (!Array.isArray(parsed)) {
            return []
        }
        const validItems: OcrMenuItem[] = []
        for (const item of parsed) {
            try {
                const validated = ocrMenuItemSchema.parse(item)
                validItems.push(validated)
            } catch {
                // Skip invalid items
            }
        }
        return validItems
    } catch {
        return []
    }
}

const MENU_EXTRACTION_SYSTEM_PROMPT =
    "You are a menu item extractor. Given an image of a cafe/restaurant menu, extract ALL menu items. Respond with a JSON array of menu items, each with: name (string), category (string), price (number or string representing a non-negative number), description (optional), is_food (optional boolean), is_hot (optional boolean), is_cold (optional boolean)."

export async function extractMenuItemsFromImage(
    imageBase64: string
): Promise<{ items: OcrMenuItem[]; rawResponse: string }> {
    const { baseUrl, apiKey } = getConfig()
    const model = process.env.OPENAI_COMPATIBLE_OCR_MODEL ?? "gpt-4o"

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
                    content: MENU_EXTRACTION_SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${imageBase64}`,
                                detail: "low",
                            },
                        },
                    ],
                },
            ],
            max_tokens: 4096,
            temperature: 0.3,
        }),
        signal: AbortSignal.timeout(120000),
    })

    if (!response.ok) {
        throw new Error(`Failed to extract menu items: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[]
    }

    const rawResponse = data.choices?.[0]?.message?.content ?? ""
    const items = parseOcrMenuItems(rawResponse)

    return { items, rawResponse }
}
