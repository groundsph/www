
import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
    console.warn("GROQ_API_KEY is not set in environment variables.");
}

const groq = new Groq({
    apiKey: apiKey || "",
});

const SYSTEM_INSTRUCTION =
    "You are an expert editor for a high-quality coffee culture blog. Your task is to write compelling, concise, and engaging excerpts for blog posts. \n\n" +
    "Guidelines:\n" +
    "- Keep the excerpt between 150-280 characters.\n" +
    "- Capture the essence of the post without giving away everything.\n" +
    "- Use an inviting and sophisticated tone, suitable for coffee enthusiasts.\n" +
    "- Avoid generic AI phrases like 'In this post, we explore...' or 'Delve into...'. Instead, jump right into the hook.\n" +
    "- Focus on the value or the story the reader will get.\n" +
    "- Do not include hashtags or emojis unless strictly relevant to a very casual topic, but generally avoid them.";

export async function generateExcerptGroq(content: string): Promise<string> {
    if (!apiKey) {
        throw new Error("Groq API key is not configured.");
    }

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: SYSTEM_INSTRUCTION
                },
                {
                    role: "user",
                    content: `Generate a compelling excerpt for the following blog post content:\n\n${content.substring(0, 10000)}`,
                },
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 300,
        });

        return completion.choices[0]?.message?.content?.trim() || "";
    } catch (error) {
        console.error("Error generating excerpt with Groq:", error);
        throw new Error("Failed to generate excerpt with Groq. Please try again.");
    }
}
