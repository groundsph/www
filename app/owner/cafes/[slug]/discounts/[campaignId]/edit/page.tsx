import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getCafeForOwnerManagement } from "@/app/api/actions/owner"
import { getCampaignById } from "@/app/api/actions/discount"
import EditCampaignForm from "@/components/owner/EditCampaignForm"

export const metadata: Metadata = {
  title: "Edit Campaign | Grounds",
  description: "Edit your discount campaign.",
}

export default async function EditCampaignPage({
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
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <EditCampaignForm
          campaign={result.data.campaign}
          cafeName={cafe.name}
          cafeSlug={slug}
        />
      </div>
    </main>
  )
}
