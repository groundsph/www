import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params

  // Redirect to the claim page on the frontend
  return NextResponse.redirect(
    new URL(`/profile/vouchers?claim=${campaignId}`, request.url).toString()
  )
}
