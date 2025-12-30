"use server";

import { generateExcerpt } from "@/utils/ai/google-ai";

interface ActionResponse {
    success: boolean;
    excerpt?: string;
    error?: string;
}

export async function generateExcerptAction(content: string): Promise<ActionResponse> {
    try {
        if (!content || content.length < 50) {
            return {
                success: false,
                error: "Content is too short to generate an excerpt. Please write at least 50 characters.",
            };
        }

        const excerpt = await generateExcerpt(content);
        return { success: true, excerpt };
    } catch (error) {
        console.error("Generate excerpt action error:", error);
        return {
            success: false,
            error: "Failed to generate excerpt. Please check your API key and try again.",
        };
    }
}
