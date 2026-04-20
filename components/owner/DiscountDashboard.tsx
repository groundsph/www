"use client"

import { useState, useMemo } from "react"
import { motion } from "motion/react"
import Link from "next/link"
import {
  Plus,
  Ticket,
  Search,
  Filter,
  Percent,
  Gift,
  Clock,
  Users,
  ExternalLink,
  ChevronRight,
} from "lucide-react"
import type { DiscountCampaign, CampaignStats } from "@/utils/types/discount"
import DiscountStatsCards from "./DiscountStatsCards"
import { cn } from "@/utils/cn"

interface DiscountDashboardProps {
  cafeId: string
  cafeName: string
  cafeSlug: string
  campaigns: DiscountCampaign[]
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

type StatusFilter = "all" | "active" | "draft" | "paused" | "expired" | "archived"

export default function DiscountDashboard({
  cafeId: _unusedCafeId,
  cafeName,
  cafeSlug,
  campaigns,
}: DiscountDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  // Calculate stats from campaigns
  const stats: CampaignStats = useMemo(() => {
    return campaigns.reduce(
      (acc, campaign) => ({
        totalVouchers: acc.totalVouchers + campaign.maxRedemptions,
        claimedVouchers: acc.claimedVouchers + (campaign.currentRedemptions || 0),
        redeemedVouchers: acc.redeemedVouchers + (campaign.currentRedemptions || 0),
        availableVouchers:
          acc.availableVouchers +
          Math.max(0, campaign.maxRedemptions - (campaign.currentRedemptions || 0)),
        expiredVouchers: acc.expiredVouchers,
      }),
      {
        totalVouchers: 0,
        claimedVouchers: 0,
        redeemedVouchers: 0,
        availableVouchers: 0,
        expiredVouchers: 0,
      }
    )
  }, [campaigns])

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      const matchesSearch =
        searchQuery === "" ||
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (campaign.description?.toLowerCase().includes(searchQuery.toLowerCase()) ??
          false)

      const matchesStatus =
        statusFilter === "all" || campaign.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [campaigns, searchQuery, statusFilter])

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "draft", label: "Draft" },
    { value: "paused", label: "Paused" },
    { value: "expired", label: "Expired" },
    { value: "archived", label: "Archived" },
  ]

  const getStatusBadgeColor = (status: DiscountCampaign["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 border-green-200"
      case "draft":
        return "bg-gray-100 text-gray-700 border-gray-200"
      case "paused":
        return "bg-amber-100 text-amber-700 border-amber-200"
      case "expired":
        return "bg-red-100 text-red-700 border-red-200"
      case "archived":
        return "bg-slate-100 text-slate-700 border-slate-200"
      default:
        return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const getDiscountTypeIcon = (type: DiscountCampaign["discountType"]) => {
    switch (type) {
      case "percentage":
        return <Percent className="w-4 h-4" />
      case "fixed_amount":
        return <Ticket className="w-4 h-4" />
      case "free_item":
        return <Gift className="w-4 h-4" />
      default:
        return <Ticket className="w-4 h-4" />
    }
  }

  const getDiscountTypeLabel = (campaign: DiscountCampaign) => {
    switch (campaign.discountType) {
      case "percentage":
        return `${campaign.discountValue}% off`
      case "fixed_amount":
        return `₱${campaign.discountValue} off`
      case "free_item":
        return campaign.freeItemName || "Free Item"
      default:
        return "Discount"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="w-full space-y-8"
    >
      {/* Header */}
      <motion.div
        variants={item}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <div className="flex items-center gap-2 text-sm text-text/60 mb-1">
            <Link
              href={`/owner/cafes/${cafeSlug}`}
              className="hover:text-primary transition-colors"
            >
              {cafeName}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Discounts</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-text">
            Discount Campaigns
          </h1>
          <p className="text-text/60 mt-1">
            Manage discount campaigns and vouchers for your cafe.
          </p>
        </div>
        <Link
          href={`/owner/cafes/${cafeSlug}/discounts/create`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={item}>
        <DiscountStatsCards stats={stats} campaignCount={campaigns.length} />
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            <Filter className="w-4 h-4 text-text/40 shrink-0" />
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  statusFilter === filter.value
                    ? "bg-primary text-white"
                    : "bg-text/5 text-text/70 hover:bg-text/10"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Campaigns List */}
      <motion.div variants={item} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {filteredCampaigns.length}{" "}
            {filteredCampaigns.length === 1 ? "Campaign" : "Campaigns"}
          </h2>
        </div>

        {filteredCampaigns.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 bg-background border border-text/10 rounded-xl"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-text/5 flex items-center justify-center">
              <Ticket className="w-10 h-10 text-text opacity-30" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {campaigns.length === 0
                ? "No Campaigns Yet"
                : "No campaigns match your filters"}
            </h3>
            <p className="text-text/60 max-w-md mx-auto mb-6">
              {campaigns.length === 0
                ? "Create your first discount campaign to start offering vouchers to customers."
                : "Try adjusting your search or filter criteria."}
            </p>
            {campaigns.length === 0 && (
              <Link
                href={`/owner/cafes/${cafeSlug}/discounts/create`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create First Campaign
              </Link>
            )}
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredCampaigns.map((campaign) => (
              <motion.div
                key={campaign.id}
                variants={item}
                className="group bg-background rounded-xl border border-text/10 overflow-hidden hover:border-primary/30 hover:shadow-md transition-all shadow-sm"
              >
                <Link
                  href={`/owner/cafes/${cafeSlug}/discounts/${campaign.id}`}
                  className="block p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Campaign Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="font-semibold text-lg truncate">
                          {campaign.name}
                        </h3>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                            getStatusBadgeColor(campaign.status)
                          )}
                        >
                          {campaign.status.charAt(0).toUpperCase() +
                            campaign.status.slice(1)}
                        </span>
                        {!campaign.isPublic && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                            Private
                          </span>
                        )}
                      </div>

                      {campaign.description && (
                        <p className="text-sm text-text/60 line-clamp-1 mb-3">
                          {campaign.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm">
                        {/* Discount Type */}
                        <span className="flex items-center gap-1.5 text-text/70">
                          <span
                            className={cn(
                              "p-1 rounded",
                              campaign.discountType === "percentage"
                                ? "bg-purple-100 text-purple-700"
                                : campaign.discountType === "free_item"
                                  ? "bg-pink-100 text-pink-700"
                                  : "bg-blue-100 text-blue-700"
                            )}
                          >
                            {getDiscountTypeIcon(campaign.discountType)}
                          </span>
                          {getDiscountTypeLabel(campaign)}
                        </span>

                        {/* Redemptions */}
                        <span className="flex items-center gap-1 text-text/60">
                          <Users className="w-4 h-4" />
                          {campaign.currentRedemptions || 0} /{" "}
                          {campaign.maxRedemptions} used
                        </span>

                        {/* End Date */}
                        <span className="flex items-center gap-1 text-text/60">
                          <Clock className="w-4 h-4" />
                          Ends {formatDate(campaign.endDate)}
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 px-3 py-2 bg-text/5 rounded-lg text-sm font-medium text-text/70 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        View Details
                        <ExternalLink className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
