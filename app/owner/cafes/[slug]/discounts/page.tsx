import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getCafeForOwnerManagement, getCafeIdBySlug } from "@/app/api/actions/owner"
import { getCampaignsForCafe } from "@/app/api/actions/discount"
import DiscountDashboard from "@/components/owner/DiscountDashboard"

export const metadata: Metadata = {
  title: "Discount Management | Grounds",
  description: "Manage discount campaigns and vouchers for your cafe.",
}

export default async function DiscountsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth?redirect=/owner")
  }

  const cafeId = await getCafeIdBySlug(slug)
  if (!cafeId) {
    notFound()
  }

  const cafe = await getCafeForOwnerManagement(cafeId)
  if (!cafe) {
    redirect("/owner")
  }

  const campaignsResult = await getCampaignsForCafe(cafe.id)

  return (
    <main className="min-h-screen w-full bg-background pt-6 pb-12">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DiscountDashboard
          cafeName={cafe.name}
          cafeSlug={slug}
          campaigns={campaignsResult.data?.campaigns ?? []}
          stats={campaignsResult.data?.stats}
        />
      </div>
    </main>
  )
}
