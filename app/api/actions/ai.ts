"use server";

import { generateExcerpt, listModels } from "@/utils/ai/openai-compatible";

interface ActionResponse {
    success: boolean;
    excerpt?: string;
    error?: string;
}

export async function listModelsAction(): Promise<{
    success: boolean;
    models?: string[];
    error?: string;
}> {
    try {
        const models = await listModels();
        return { success: true, models };
    } catch (error) {
        console.error("List models action error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to list models",
        };
    }
}

export async function generateExcerptAction(
    content: string
): Promise<ActionResponse> {
    try {
        if (!content || content.length < 50) {
            return {
                success: false,
                error: "Content is too short to generate an excerpt. Please write at least 50 characters.",
            };
        }

        const model = process.env.OPENAI_COMPATIBLE_EXCERPT_MODEL ?? "gpt-4o-mini";
        const excerpt = await generateExcerpt(content, model);

        return { success: true, excerpt };
    } catch (error) {
        console.error("Generate excerpt action error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to generate excerpt",
        };
    }
}
