import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Claim Voucher | Grounds",
  description: "Claim your discount voucher.",
}

export default async function ClaimPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth?redirect=/profile/vouchers")
  }

  redirect("/profile/vouchers")
}
