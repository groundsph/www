import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params
        const supabase = await createClient()

        const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single()

        if (error) {
            console.error("Error fetching profile:", error)
            return NextResponse.json(null, { status: 404 })
        }

        return NextResponse.json(profile)
    } catch (err) {
        console.error("Unexpected error:", err)
        return NextResponse.json(null, { status: 500 })
    }
}
