const BLOCKED_PATTERNS = [
    /\b(fuck|shit|bitch|ass|damn|crap)\b/i,
    /\b(kill|die|murder|suicide)\b/i,
    /\b(hack|exploit|inject|sql|drop table)\b/i,
]

const OFF_TOPIC_INDICATORS = [
    /\b(write me a poem|tell me a joke|what's the weather)\b/i,
]

export interface ModerationResult {
    allowed: boolean
    reason?: string
    flag?: "profanity" | "off_topic" | "injection"
}

export function moderateMessage(text: string): ModerationResult {
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(text)) {
            return {
                allowed: false,
                reason: "Your message contains content that isn't allowed. Please keep conversations about cafes and coffee.",
                flag: "profanity",
            }
        }
    }

    for (const pattern of OFF_TOPIC_INDICATORS) {
        if (pattern.test(text)) {
            return {
                allowed: false,
                reason: "I can only help with cafe and coffee-related questions. Let's talk about cafes!",
                flag: "off_topic",
            }
        }
    }

    // Check for potential injection attempts
    if (text.includes("ignore previous instructions") || text.includes("system prompt")) {
        return {
            allowed: false,
            reason: "I can only help with cafe and coffee-related questions.",
            flag: "injection",
        }
    }

    return { allowed: true }
}
