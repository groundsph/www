"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "motion/react"
import {
  ScanLine,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react"
import { useNotification } from "@/components/layout/NotificationProvider"
import { getRedemptionLogs } from "@/app/api/actions/discount"
import type { VoucherRedemptionLog } from "@/utils/types/discount"

interface RedemptionLogsTableProps {
  campaignId: string
}

const PAGE_SIZE = 20

export default function RedemptionLogsTable({ campaignId }: RedemptionLogsTableProps) {
  const { addNotification } = useNotification()
  const [logs, setLogs] = useState<VoucherRedemptionLog[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getRedemptionLogs(campaignId, currentPage)
      if (result.success && result.data) {
        setLogs(result.data.logs)
        setTotal(result.data.total)
      } else {
        addNotification(result.error || "Failed to fetch redemption logs", "error")
      }
    } catch (error) {
      console.error("Error fetching logs:", error)
      addNotification("An unexpected error occurred", "error")
    } finally {
      setIsLoading(false)
    }
  }, [campaignId, currentPage, addNotification])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-text/60">Loading redemption logs...</p>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 bg-background border border-text/10 rounded-xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-text/5 flex items-center justify-center">
          <ScanLine className="w-8 h-8 text-text/30" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Redemption Logs</h3>
        <p className="text-text/60 max-w-md mx-auto">
          No vouchers have been redeemed for this campaign yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <p className="text-sm text-text/60">
          Showing {logs.length} of {total} logs
        </p>
      </div>

      <div className="bg-background rounded-xl border border-text/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-text/5 border-b border-text/10">
                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">
                  User
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">
                  Discount
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">
                  Method
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-text/10">
              {logs.map((log) => (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-text/5 transition-colors"
                >
                  <td className="px-4 py-3">
                    <code className="font-mono text-sm">{log.code}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-text/60 font-mono">
                      {log.userId
                        ? `${log.userId.slice(0, 8)}...`
                        : "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">
                      {log.discountType === "percentage"
                        ? `${log.discountValue}% off`
                        : log.discountType === "fixed_amount"
                          ? `₱${log.discountValue} off`
                          : log.freeItemName || "Free Item"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-text/5 text-text/70 border border-text/10">
                      {log.redemptionMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">
                      {formatDateTime(log.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-text/60">
                      {log.notes || "-"}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
