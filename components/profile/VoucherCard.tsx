"use client"

import { useState } from "react"
import { motion } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import {
  Ticket,
  Copy,
  Check,
  Percent,
  PhilippinePeso,
  Gift,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
} from "lucide-react"
import { UserVoucher } from "@/utils/types/discount"
import { cn } from "@/utils/cn"
import { getCafeThumbnailUrl } from "@/utils/extras"

interface VoucherCardProps {
  voucher: UserVoucher
}

const discountTypeConfig = {
  percentage: {
    icon: Percent,
    label: "Off",
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-600",
    borderClass: "border-blue-500/30",
  },
  fixed_amount: {
    icon: PhilippinePeso,
    label: "Off",
    bgClass: "bg-green-500/10",
    textClass: "text-green-600",
    borderClass: "border-green-500/30",
  },
  free_item: {
    icon: Gift,
    label: "Free Item",
    bgClass: "bg-purple-500/10",
    textClass: "text-purple-600",
    borderClass: "border-purple-500/30",
  },
}

function formatDiscountValue(type: string, value: number, freeItemName: string | null): string {
  switch (type) {
    case "percentage":
      return `${value}%`
    case "fixed_amount":
      return `₱${value.toLocaleString()}`
    case "free_item":
      return freeItemName || "Free Item"
    default:
      return ""
  }
}

function formatDate(dateString: string): string {
  if (!dateString) return "N/A"
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  const expiryDate = new Date(expiresAt)
  const now = new Date()
  const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays <= 7 && diffDays > 0
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

export default function VoucherCard({ voucher }: VoucherCardProps) {
  const [copied, setCopied] = useState(false)
  const config = discountTypeConfig[voucher.campaign.discountType]
  const DiscountIcon = config.icon

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(voucher.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silently fail
    }
  }

  const isActive = voucher.status === "claimed"
  const expired = isExpired(voucher.expiresAt)
  const expiringSoon = isExpiringSoon(voucher.expiresAt)

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 8px 30px -10px rgba(0,0,0,0.15)" }}
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all",
        isActive
          ? "bg-background border-text/10"
          : "bg-text/5 border-text/10 opacity-75"
      )}
    >
      {/* Status Badge */}
      <div
        className={cn(
          "absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold",
          isActive
            ? "bg-green-500/10 text-green-600 border border-green-500/30"
            : "bg-text/10 text-text/60 border border-text/20"
        )}
      >
        {isActive ? "Active" : "Redeemed"}
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex gap-4">
          {/* Left: Discount Badge */}
          <div
            className={cn(
              "flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex flex-col items-center justify-center border",
              config.bgClass,
              config.borderClass
            )}
          >
            <DiscountIcon className={cn("w-5 h-5 sm:w-6 sm:h-6", config.textClass)} />
            <span className={cn("text-lg sm:text-xl font-bold mt-0.5", config.textClass)}>
              {voucher.campaign.discountType === "free_item"
                ? "FREE"
                : formatDiscountValue(
                    voucher.campaign.discountType,
                    voucher.campaign.discountValue,
                    voucher.campaign.freeItemName
                  )}
            </span>
          </div>

          {/* Right: Content */}
          <div className="flex-1 min-w-0">
            {/* Campaign Name */}
            <h3 className="font-semibold text-lg leading-tight pr-20">
              {voucher.campaign.name}
            </h3>

            {/* Cafe Info */}
            <Link
              href={`/cafes/${voucher.campaign.cafeSlug}`}
              className="flex items-center gap-2 mt-1.5 group"
            >
              {voucher.campaign.cafeThumbnail ? (
                <div className="relative w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                  <Image
                    src={getCafeThumbnailUrl(voucher.campaign.cafeThumbnail)}
                    alt={voucher.campaign.cafeName}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-text/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-3 h-3 text-text/40" />
                </div>
              )}
              <span className="text-sm text-text/70 group-hover:text-primary transition-colors truncate">
                {voucher.campaign.cafeName}
              </span>
              <ExternalLink className="w-3 h-3 text-text/30 group-hover:text-primary transition-colors flex-shrink-0" />
            </Link>

            {/* Voucher Code */}
            <div className="flex items-center gap-2 mt-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-text/5 border border-text/10 rounded-lg">
                <Ticket className="w-3.5 h-3.5 text-text/40" />
                <span className="font-mono text-sm font-medium tracking-wider">
                  {voucher.code}
                </span>
              </div>
              {isActive && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg hover:bg-text/10 transition-colors"
                  title="Copy code"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-text/40" />
                  )}
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-text/10 my-4" />

        {/* Footer: Dates */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text/60">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Valid {formatDate(voucher.campaign.startDate)} - {formatDate(voucher.campaign.endDate)}</span>
          </div>

          {voucher.expiresAt && (
            <div
              className={cn(
                "flex items-center gap-1.5",
                expired && "text-red-500",
                expiringSoon && !expired && "text-amber-500"
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {expired
                  ? "Expired"
                  : expiringSoon
                  ? "Expires soon"
                  : `Expires ${formatDate(voucher.expiresAt)}`}
              </span>
            </div>
          )}

          {voucher.redeemedAt && (
            <div className="flex items-center gap-1.5 text-text/50">
              <Check className="w-3.5 h-3.5" />
              <span>Redeemed {formatDate(voucher.redeemedAt)}</span>
            </div>
          )}
        </div>

        {/* Terms (if available) */}
        {voucher.campaign.termsAndConditions && isActive && (
          <div className="mt-3 pt-3 border-t border-text/5">
            <p className="text-xs text-text/50 line-clamp-2">
              <span className="font-medium">Terms:</span> {voucher.campaign.termsAndConditions}
            </p>
          </div>
        )}
      </div>

      {/* Expired/Redeemed Overlay */}
      {!isActive && (
        <div className="absolute inset-0 bg-background/50 pointer-events-none flex items-center justify-center">
          <div className="px-4 py-2 bg-text/80 text-white rounded-full text-sm font-medium transform rotate-[-5deg]">
            {voucher.status === "redeemed" ? "Redeemed" : "Expired"}
          </div>
        </div>
      )}
    </motion.div>
  )
}
