"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "motion/react"
import { Ticket, Percent, Gift, Clock } from "lucide-react"
import { getPublicCampaignsForCafe, claimVoucherFromCampaign } from "@/app/api/actions/discount"
import { useAuth } from "@/components/layout/AuthProvider"
import { useNotification } from "@/components/layout/NotificationProvider"
import { useRouter } from "next/navigation"
import type { DiscountCampaign } from "@/utils/types/discount"

interface CafeDiscountsProps {
  cafeId: string
}

export default function CafeDiscounts({ cafeId }: CafeDiscountsProps) {
  const [campaigns, setCampaigns] = useState<DiscountCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set())
  const { user, isLoading: isAuthLoading } = useAuth()
  const { addNotification } = useNotification()
  const router = useRouter()

  useEffect(() => {
    getPublicCampaignsForCafe(cafeId).then((result) => {
      if (result.success && result.data) {
        setCampaigns(result.data.campaigns)
      }
      setLoading(false)
    })
  }, [cafeId])

  const handleClaim = useCallback(async (campaignId: string) => {
    setClaimingId(campaignId)
    const result = await claimVoucherFromCampaign({ campaignId })
    if (result.success) {
      setClaimedIds((prev) => new Set(prev).add(campaignId))
      router.refresh()
    } else {
      addNotification(result.error ?? "Failed to claim voucher", "error")
    }
    setClaimingId(null)
  }, [router, addNotification])

  if (loading) return null
  if (campaigns.length === 0) return null

  const getDiscountIcon = (type: string) => {
    switch (type) {
      case "percentage": return <Percent className="w-5 h-5" />
      case "fixed_amount": return <span className="text-sm font-bold">₱</span>
      case "free_item": return <Gift className="w-5 h-5" />
      default: return <Ticket className="w-5 h-5" />
    }
  }

  const getDiscountLabel = (type: string, value: number, freeItemName?: string | null) => {
    switch (type) {
      case "percentage": return `${value}% off`
      case "fixed_amount": return `₱${value} off`
      case "free_item": return `Free ${freeItemName ?? "item"}`
      default: return `${value} off`
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-serif font-bold flex items-center gap-2">
        <Ticket className="w-5 h-5 text-primary" />
        Current Discounts
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {campaigns.map((campaign) => (
          <motion.div
            key={campaign.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-4 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {getDiscountIcon(campaign.discountType)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold truncate">{campaign.name}</h3>
                <p className="text-primary font-medium text-sm mt-0.5">
                  {getDiscountLabel(campaign.discountType, campaign.discountValue, campaign.freeItemName)}
                </p>
                {campaign.description && (
                  <p className="text-text/60 text-sm mt-1 line-clamp-2">{campaign.description}</p>
                )}
                <div className="flex items-center gap-1.5 mt-2 text-xs text-text/50">
                  <Clock className="w-3 h-3" />
                  Valid until {new Date(campaign.endDate).toLocaleDateString()}
                </div>
                {user && !isAuthLoading && (
                  <button
                    onClick={() => handleClaim(campaign.id)}
                    disabled={claimingId === campaign.id || claimedIds.has(campaign.id)}
                    className="mt-3 w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {claimedIds.has(campaign.id)
                      ? "Claimed!"
                      : claimingId === campaign.id
                        ? "Claiming..."
                        : "Claim Voucher"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
