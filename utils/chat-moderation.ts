const BLOCKED_PATTERNS = [
    /\b(fuck|shit|bitch|ass|damn|crap)\b/i,
    /\b(kill|die|murder|suicide)\b/i,
    /\b(hack|exploit|inject|sql|drop table)\b/i,
    /\b(nigger|faggot|retard)\b/i, // Slurs
    /\b(bomb|terrorist|threat)\b/i, // Threats
]

const OFF_TOPIC_INDICATORS = [
    /\b(write me a poem|tell me a joke|what's the weather)\b/i,
    /\b(write code|debug this|fix my code)\b/i,
    /\b(solve this math|calculate|equation)\b/i,
    /\b(do my homework|write my essay)\b/i,
]

const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /you\s+are\s+now\s+(a\s+)?different\s+(ai|assistant|model)/i,
    /system\s*prompt/i,
    /act\s+as\s+if\s+you\s+are/i,
    /pretend\s+you\s+are/i,
    /ignore\s+your\s+(rules|instructions|guidelines)/i,
    /forget\s+everything\s+(you\s+)?know/i,
    /new\s+instructions?:/i,
    /\[system\]/i,
    /\[INST\]/i,
    /<\|im_start\|>/i,
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

    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(text)) {
            return {
                allowed: false,
                reason: "I can only help with cafe and coffee-related questions.",
                flag: "injection",
            }
        }
    }

    return { allowed: true }
}
