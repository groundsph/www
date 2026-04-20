"use client"

import { motion } from "motion/react"
import { Ticket, Users, CheckCircle2, Clock } from "lucide-react"
import type { CampaignStats } from "@/utils/types/discount"

interface DiscountStatsCardsProps {
  stats: CampaignStats
  campaignCount: number
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function DiscountStatsCards({ stats, campaignCount }: DiscountStatsCardsProps) {
  const cards = [
    {
      label: "Total Campaigns",
      value: campaignCount,
      icon: Ticket,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Vouchers Claimed",
      value: stats.claimedVouchers,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Redeemed",
      value: stats.redeemedVouchers,
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      label: "Available",
      value: stats.availableVouchers,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ]

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {cards.map((card) => (
        <motion.div
          key={card.label}
          variants={item}
          className="bg-card rounded-xl p-4 border border-border"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-sm text-text/60">{card.label}</p>
              <p className="text-xl font-bold">{card.value}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
