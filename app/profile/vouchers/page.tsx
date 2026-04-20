import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getUserVouchers } from "@/app/api/actions/discount"
import VoucherWallet from "@/components/profile/VoucherWallet"

export const metadata: Metadata = {
  title: "My Vouchers | Grounds",
  description: "View and manage your discount vouchers.",
}

export default async function VouchersPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth?redirect=/profile/vouchers")
  }

  const result = await getUserVouchers()

  return (
    <main className="min-h-screen w-full bg-background pt-6 pb-12">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <VoucherWallet vouchers={result.data?.vouchers ?? []} />
      </div>
    </main>
  )
}
