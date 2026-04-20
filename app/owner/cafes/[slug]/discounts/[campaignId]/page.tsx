import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getCafeForOwnerManagement } from "@/app/api/actions/owner"
import { getCampaignById } from "@/app/api/actions/discount"
import CampaignDetail from "@/components/owner/CampaignDetail"

export const metadata: Metadata = {
  title: "Campaign Details | Grounds",
  description: "View and manage your discount campaign.",
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ slug: string; campaignId: string }>
}) {
  const { slug, campaignId } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth?redirect=/owner")
  }

  const cafe = await getCafeForOwnerManagement(slug)
  if (!cafe) {
    redirect("/owner")
  }

  const result = await getCampaignById(campaignId)
  if (!result.success || !result.data) {
    redirect(`/owner/cafes/${slug}/discounts`)
  }

  return (
    <main className="min-h-screen w-full bg-background pt-6 pb-12">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <CampaignDetail
          campaign={result.data.campaign}
          stats={result.data.stats}
          cafeId={cafe.id}
          cafeName={cafe.name}
          cafeSlug={slug}
        />
      </div>
    </main>
  )
}
