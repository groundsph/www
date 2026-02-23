import { useEffect } from "react"
import type { ChatContext } from "@/utils/types/chat"
import { setChatContext } from "@/utils/chat-context"

export function useChatContext(ctx: ChatContext) {
    useEffect(() => {
        setChatContext(ctx)
    }, [ctx])
}
