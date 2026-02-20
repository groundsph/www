import { getChatEnabled } from "@/utils/feature-flags"

export async function GET() {
    const enabled = await getChatEnabled()
    return Response.json({ enabled })
}
