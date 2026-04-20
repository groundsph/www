"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "motion/react"
import {
  Ticket,
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
} from "lucide-react"
import { cn } from "@/utils/cn"
import { useNotification } from "@/components/layout/NotificationProvider"
import { getCampaignVouchers, cancelVoucher } from "@/app/api/actions/discount"

interface CampaignVoucher {
  id: string
  campaignId: string
  code: string
  userId: string | null
  status: string
  claimedAt: string | null
  redeemedAt: string | null
  redeemedByCafeId: string | null
  redemptionNotes: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

interface VoucherTableProps {
  campaignId: string
}

type StatusFilter = "all" | "available" | "claimed" | "redeemed" | "expired" | "cancelled"

const PAGE_SIZE = 20

export default function VoucherTable({ campaignId }: VoucherTableProps) {
  const { addNotification } = useNotification()
  const [vouchers, setVouchers] = useState<CampaignVoucher[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchVouchers = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getCampaignVouchers(campaignId, currentPage, PAGE_SIZE)
      if (result.success && result.data) {
        setVouchers(result.data.vouchers)
        setTotal(result.data.total)
      } else {
        addNotification(result.error || "Failed to fetch vouchers", "error")
      }
    } catch (error) {
      console.error("Error fetching vouchers:", error)
      addNotification("An unexpected error occurred", "error")
    } finally {
      setIsLoading(false)
    }
  }, [campaignId, currentPage, addNotification])

  useEffect(() => {
    fetchVouchers()
  }, [fetchVouchers])

  const handleCopy = useCallback(async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
      addNotification("Code copied to clipboard", "success")
    } catch {
      addNotification("Failed to copy code", "error")
    }
  }, [addNotification])

  const handleCancel = useCallback(async (voucherId: string) => {
    if (!confirm("Are you sure you want to cancel this voucher? This action cannot be undone.")) {
      return
    }

    setCancellingId(voucherId)
    try {
      const result = await cancelVoucher(voucherId)
      if (result.success) {
        // Update the voucher status locally
        setVouchers((prev) =>
          prev.map((v) =>
            v.id === voucherId ? { ...v, status: "cancelled" } : v
          )
        )
        addNotification("Voucher cancelled successfully", "success")
      } else {
        addNotification(result.error || "Failed to cancel voucher", "error")
      }
    } catch (error) {
      console.error("Error cancelling voucher:", error)
      addNotification("An unexpected error occurred", "error")
    } finally {
      setCancellingId(null)
    }
  }, [addNotification])

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-blue-100 text-blue-700 border-blue-200"
      case "claimed":
        return "bg-purple-100 text-purple-700 border-purple-200"
      case "redeemed":
        return "bg-green-100 text-green-700 border-green-200"
      case "expired":
        return "bg-gray-100 text-gray-700 border-gray-200"
      case "cancelled":
        return "bg-red-100 text-red-700 border-red-200"
      default:
        return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const filteredVouchers = vouchers.filter((v) =>
    statusFilter === "all" ? true : v.status === statusFilter
  )

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "available", label: "Available" },
    { value: "claimed", label: "Claimed" },
    { value: "redeemed", label: "Redeemed" },
    { value: "expired", label: "Expired" },
    { value: "cancelled", label: "Cancelled" },
  ]

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-text/60">Loading vouchers...</p>
      </div>
    )
  }

  if (vouchers.length === 0) {
    return (
      <div className="text-center py-12 bg-background border border-text/10 rounded-xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-text/5 flex items-center justify-center">
          <Ticket className="w-8 h-8 text-text/30" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Vouchers Yet</h3>
        <p className="text-text/60 max-w-md mx-auto">
          This campaign doesn&apos;t have any vouchers yet. Generate some vouchers to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <Filter className="w-4 h-4 text-text/40 shrink-0" />
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                statusFilter === filter.value
                  ? "bg-primary text-white"
                  : "bg-text/5 text-text/70 hover:bg-text/10"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-text/60">
          Showing {filteredVouchers.length} of {total} vouchers
        </p>
      </div>

      {/* Table */}
      <div className="bg-background rounded-xl border border-text/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-text/5 border-b border-text/10">
                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">
                  User ID
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">
                  Claimed
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">
                  Redeemed
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">
                  Expires
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text/60">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-text/10">
              {filteredVouchers.map((voucher) => (
                <motion.tr
                  key={voucher.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-text/5 transition-colors"
                >
                  <td className="px-4 py-3">
                    <code className="font-mono text-sm">{voucher.code}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                        getStatusBadgeColor(voucher.status)
                      )}
                    >
                      {voucher.status.charAt(0).toUpperCase() +
                        voucher.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-text/60 font-mono">
                      {voucher.userId
                        ? `${voucher.userId.slice(0, 8)}...`
                        : "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{formatDate(voucher.claimedAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{formatDate(voucher.redeemedAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{formatDate(voucher.expiresAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleCopy(voucher.code, voucher.id)}
                        className="p-1.5 hover:bg-text/10 rounded transition-colors"
                        title="Copy code"
                      >
                        {copiedId === voucher.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-text/60" />
                        )}
                      </button>
                      {voucher.status === "available" && (
                        <button
                          onClick={() => handleCancel(voucher.id)}
                          disabled={cancellingId === voucher.id}
                          className="p-1.5 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                          title="Cancel voucher"
                        >
                          {cancellingId === voucher.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-text/60" />
                          ) : (
                            <X className="w-4 h-4 text-red-500" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center gap-1 px-3 py-2 bg-text/5 rounded-lg text-sm font-medium hover:bg-text/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-sm text-text/60">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center gap-1 px-3 py-2 bg-text/5 rounded-lg text-sm font-medium hover:bg-text/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
