
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
    console.warn("GOOGLE_GENERATIVE_AI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction:
        "You are an expert editor for a high-quality coffee culture blog. Your task is to write compelling, concise, and engaging excerpts for blog posts. \n\n" +
        "Guidelines:\n" +
        "- Keep the excerpt between 150-280 characters.\n" +
        "- Capture the essence of the post without giving away everything.\n" +
        "- Use an inviting and sophisticated tone, suitable for coffee enthusiasts.\n" +
        "- Avoid generic AI phrases like 'In this post, we explore...' or 'Delve into...'. Instead, jump right into the hook.\n" +
        "- Focus on the value or the story the reader will get.\n" +
        "- Do not include hashtags or emojis unless strictly relevant to a very casual topic, but generally avoid them.",
});

export async function generateExcerpt(content: string): Promise<string> {
    if (!apiKey) {
        throw new Error("Google AI API key is not configured.");
    }

    try {
        const result = await model.generateContent(
            `Generate a compelling excerpt for the following blog post content:\n\n${content.substring(0, 10000)}`
            // Truncating to 10k chars to be safe, though Flash handles much more. 
            // It helps focusing on the intro which usually contains the core idea.
        );
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Error generating excerpt:", error);
        throw new Error("Failed to generate excerpt. Please try again.");
    }
}
