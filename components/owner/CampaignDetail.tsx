"use client"

import { useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  ArrowLeft,
  Edit,
  Pause,
  Play,
  Archive,
  Plus,
  Ticket,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  Percent,
  Gift,
  BarChart3,
  List,
  ScanLine,
  ChevronRight,
  QrCode,
} from "lucide-react"
import type { DiscountCampaign, CampaignStats } from "@/utils/types/discount"
import { cn } from "@/utils/cn"
import { useNotification } from "@/components/layout/NotificationProvider"
import { updateCampaign, deleteCampaign } from "@/app/api/actions/discount"
import GenerateVouchersModal from "./GenerateVouchersModal"
import VoucherRedeemPanel from "./VoucherRedeemPanel"
import VoucherTable from "./VoucherTable"
import CampaignQRModal from "./CampaignQRModal"

interface CampaignDetailProps {
  campaign: DiscountCampaign
  stats: CampaignStats
  cafeId: string
  cafeName: string
  cafeSlug: string
}

type Tab = "overview" | "vouchers" | "logs"

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

export default function CampaignDetail({
  campaign: initialCampaign,
  stats,
  cafeName,
  cafeSlug,
}: CampaignDetailProps) {
  const router = useRouter()
  const { addNotification } = useNotification()
  const [campaign, setCampaign] = useState<DiscountCampaign>(initialCampaign)
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)
  const [isQRModalOpen, setIsQRModalOpen] = useState(false)

  const isArchived = campaign.status === "archived"
  const isActive = campaign.status === "active"
  const isPaused = campaign.status === "paused"
  const isDraft = campaign.status === "draft"

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
        return <Percent className="w-5 h-5" />
      case "fixed_amount":
        return <Ticket className="w-5 h-5" />
      case "free_item":
        return <Gift className="w-5 h-5" />
      default:
        return <Ticket className="w-5 h-5" />
    }
  }

  const getDiscountLabel = useMemo(() => {
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
  }, [campaign.discountType, campaign.discountValue, campaign.freeItemName])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const handleToggleStatus = useCallback(async () => {
    if (isArchived || isDraft) return

    setIsTogglingStatus(true)
    const newStatus = isActive ? "paused" : "active"

    try {
      const result = await updateCampaign(campaign.id, { status: newStatus })
      if (result.success && result.data) {
        setCampaign(result.data.campaign)
        addNotification(
          `Campaign ${newStatus === "active" ? "resumed" : "paused"} successfully`,
          "success"
        )
      } else {
        addNotification(result.error || "Failed to update status", "error")
      }
    } catch (error) {
      console.error("Error toggling status:", error)
      addNotification("An unexpected error occurred", "error")
    } finally {
      setIsTogglingStatus(false)
    }
  }, [campaign.id, isActive, isArchived, isDraft, addNotification])

  const handleArchive = useCallback(async () => {
    if (!confirm("Are you sure you want to archive this campaign? This will cancel all unused vouchers.")) {
      return
    }

    setIsArchiving(true)
    try {
      const result = await deleteCampaign(campaign.id)
      if (result.success) {
        addNotification("Campaign archived successfully", "success")
        router.push(`/owner/cafes/${cafeSlug}/discounts`)
      } else {
        addNotification(result.error || "Failed to archive campaign", "error")
      }
    } catch (error) {
      console.error("Error archiving campaign:", error)
      addNotification("An unexpected error occurred", "error")
    } finally {
      setIsArchiving(false)
    }
  }, [campaign.id, cafeSlug, router, addNotification])

  const statsCards = [
    {
      label: "Total Vouchers",
      value: stats.totalVouchers,
      icon: Ticket,
      color: "bg-blue-100 text-blue-700",
    },
    {
      label: "Claimed",
      value: stats.claimedVouchers,
      icon: Users,
      color: "bg-purple-100 text-purple-700",
    },
    {
      label: "Redeemed",
      value: stats.redeemedVouchers,
      icon: CheckCircle,
      color: "bg-green-100 text-green-700",
    },
    {
      label: "Available",
      value: stats.availableVouchers,
      icon: Clock,
      color: "bg-amber-100 text-amber-700",
    },
  ]

  const canGenerateVouchers =
    !isArchived && stats.totalVouchers < campaign.maxRedemptions

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="w-full space-y-6"
    >
      {/* Breadcrumb & Back */}
      <motion.div variants={item}>
        <Link
          href={`/owner/cafes/${cafeSlug}/discounts`}
          className="inline-flex items-center gap-1 text-text/60 hover:text-text mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Campaigns
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div
        variants={item}
        className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4"
      >
        <div className="flex-1">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-text/60 mb-2">
            <Link
              href={`/owner/cafes/${cafeSlug}`}
              className="hover:text-primary transition-colors"
            >
              {cafeName}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link
              href={`/owner/cafes/${cafeSlug}/discounts`}
              className="hover:text-primary transition-colors"
            >
              Discounts
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="truncate max-w-[200px]">{campaign.name}</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-text">
              {campaign.name}
            </h1>
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                getStatusBadgeColor(campaign.status)
              )}
            >
              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
            </span>
            {!campaign.isPublic && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                Private
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-3 text-sm">
            <span
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded",
                campaign.discountType === "percentage"
                  ? "bg-purple-100 text-purple-700"
                  : campaign.discountType === "free_item"
                    ? "bg-pink-100 text-pink-700"
                    : "bg-blue-100 text-blue-700"
              )}
            >
              {getDiscountTypeIcon(campaign.discountType)}
              {getDiscountLabel}
            </span>
            <span className="text-text/60">
              {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
            </span>
          </div>

          {campaign.description && (
            <p className="text-text/60 mt-3 max-w-2xl">{campaign.description}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Edit Button */}
          {!isArchived && (
            <Link
              href={`/owner/cafes/${cafeSlug}/discounts/${campaign.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-text/10 rounded-lg text-sm font-medium hover:bg-text/20 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Link>
          )}

          {/* Pause/Resume Button */}
          {(isActive || isPaused) && (
            <button
              onClick={handleToggleStatus}
              disabled={isTogglingStatus}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50",
                isActive
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "bg-green-100 text-green-700 hover:bg-green-200"
              )}
            >
              {isTogglingStatus ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Clock className="w-4 h-4" />
                </motion.div>
              ) : isActive ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isActive ? "Pause" : "Resume"}
            </button>
          )}

          {/* Generate Vouchers Button */}
          {canGenerateVouchers && (
            <button
              onClick={() => setIsGenerateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Generate Vouchers
            </button>
          )}

          {/* QR Code Button */}
          {campaign.qrCodeEnabled && (
            <button
              onClick={() => setIsQRModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-text/10 rounded-lg text-sm font-medium hover:bg-text/20 transition-colors"
            >
              <QrCode className="w-4 h-4" />
              QR Code
            </button>
          )}

          {/* Archive Button */}
          {!isArchived && (
            <button
              onClick={handleArchive}
              disabled={isArchiving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
            >
              {isArchiving ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Clock className="w-4 h-4" />
                </motion.div>
              ) : (
                <Archive className="w-4 h-4" />
              )}
              Archive
            </button>
          )}
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={item}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((card) => (
            <div
              key={card.label}
              className="bg-background rounded-xl border border-text/10 p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("p-1.5 rounded", card.color)}>
                  <card.icon className="w-4 h-4" />
                </div>
                <span className="text-sm text-text/60">{card.label}</span>
              </div>
              <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={item}>
        <div className="border-b border-text/10">
          <div className="flex gap-1">
            {[
              { id: "overview" as Tab, label: "Overview", icon: BarChart3 },
              { id: "vouchers" as Tab, label: "Vouchers", icon: List },
              { id: "logs" as Tab, label: "Redemption Logs", icon: ScanLine },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-text/60 hover:text-text hover:border-text/20"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </motion.div>

      {/* Tab Content */}
      <motion.div variants={item}>
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Redeem Panel */}
              {!isArchived && <VoucherRedeemPanel campaignId={campaign.id} />}

              {/* Campaign Details */}
              <div className="bg-background rounded-xl border border-text/10 p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Campaign Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm text-text/60">Campaign ID</span>
                      <p className="font-mono text-sm">{campaign.id}</p>
                    </div>
                    <div>
                      <span className="text-sm text-text/60">Code Prefix</span>
                      <p>{campaign.codePrefix || "GROUNDS"}</p>
                    </div>
                    <div>
                      <span className="text-sm text-text/60">Max Redemptions</span>
                      <p>{campaign.maxRedemptions.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-sm text-text/60">Max Per User</span>
                      <p>{campaign.maxPerUser ?? 1}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm text-text/60">Start Date</span>
                      <p>{formatDateTime(campaign.startDate)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-text/60">End Date</span>
                      <p>{formatDateTime(campaign.endDate)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-text/60">QR Code</span>
                      <p>{campaign.qrCodeEnabled ? "Enabled" : "Disabled"}</p>
                    </div>
                    <div>
                      <span className="text-sm text-text/60">Visibility</span>
                      <p>{campaign.isPublic ? "Public" : "Private"}</p>
                    </div>
                  </div>
                </div>

                {campaign.termsAndConditions && (
                  <div className="mt-6 pt-6 border-t border-text/10">
                    <span className="text-sm text-text/60">Terms & Conditions</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap">
                      {campaign.termsAndConditions}
                    </p>
                  </div>
                )}

                {campaign.minPurchaseAmount && (
                  <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <p className="text-sm text-amber-700">
                      Minimum purchase amount: ₱{campaign.minPurchaseAmount}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "vouchers" && (
            <motion.div
              key="vouchers"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <VoucherTable campaignId={campaign.id} />
            </motion.div>
          )}

          {activeTab === "logs" && (
            <motion.div
              key="logs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-text/5 flex items-center justify-center">
                <ScanLine className="w-8 h-8 text-text/30" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Redemption Logs</h3>
              <p className="text-text/60 max-w-md mx-auto">
                Redemption logs will be available in a future update.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Generate Vouchers Modal */}
      <GenerateVouchersModal
        open={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        campaignId={campaign.id}
        maxVouchers={campaign.maxRedemptions}
        existingVouchers={stats.totalVouchers}
      />

      {/* Campaign QR Modal */}
      <CampaignQRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        campaignId={campaign.id}
        campaignName={campaign.name}
        baseUrl={typeof window !== "undefined" ? window.location.origin : ""}
      />
    </motion.div>
  )
}
