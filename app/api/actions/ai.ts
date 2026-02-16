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
    defaultModel?: string;
    error?: string;
}> {
    try {
        const models = await listModels();
        const defaultModel = process.env.OPENAI_COMPATIBLE_EXCERPT_MODEL;
        return { success: true, models, defaultModel };
    } catch (error) {
        console.error("List models action error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to list models",
        };
    }
}

export async function generateExcerptAction(
    content: string,
    model: string
): Promise<ActionResponse> {
    try {
        if (!content || content.length < 50) {
            return {
                success: false,
                error: "Content is too short to generate an excerpt. Please write at least 50 characters.",
            };
        }

        if (!model) {
            return {
                success: false,
                error: "No model selected. Please select a model.",
            };
        }

        const excerpt = await generateExcerpt(model, content);

        return { success: true, excerpt };
    } catch (error) {
        console.error("Generate excerpt action error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to generate excerpt",
        };
    }
}
