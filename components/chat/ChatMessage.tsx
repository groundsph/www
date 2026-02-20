"use client"

import MarkdownRender from "@/components/ui/MarkdownRender"

interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
}

interface ChatMessageProps {
    message: Message
}

export default function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user"

    return (
        <div
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
        >
            <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                    isUser
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-muted-foreground rounded-bl-md"
                }`}
            >
                {isUser ? (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                ) : (
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                        <MarkdownRender content={message.content} />
                    </div>
                )}
            </div>
        </div>
    )
}
