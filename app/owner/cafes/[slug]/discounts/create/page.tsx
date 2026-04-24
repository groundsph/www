import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getCafeForOwnerManagement, getCafeIdBySlug } from "@/app/api/actions/owner"
import CreateCampaignForm from "@/components/owner/CreateCampaignForm"

export const metadata: Metadata = {
  title: "Create Discount Campaign | Grounds",
  description: "Create a new discount campaign for your cafe.",
}

export default async function CreateCampaignPage({
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

  return (
    <main className="min-h-screen w-full bg-background pt-6 pb-12">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <CreateCampaignForm cafeId={cafe.id} cafeName={cafe.name} cafeSlug={slug} />
      </div>
    </main>
  )
}
