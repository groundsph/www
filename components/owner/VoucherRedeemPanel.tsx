"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  ScanLine,
  Search,
  CheckCircle,
  Ticket,
  Percent,
  Gift,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react"
import { cn } from "@/utils/cn"
import { useNotification } from "@/components/layout/NotificationProvider"
import {
  redeemVoucher,
  lookupVoucherByCode,
} from "@/app/api/actions/discount"
import type { RedeemableVoucher } from "@/utils/types/discount"

export default function VoucherRedeemPanel() {
  const { addNotification } = useNotification()
  const [code, setCode] = useState("")
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [foundVoucher, setFoundVoucher] = useState<RedeemableVoucher | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [redeemedVoucher, setRedeemedVoucher] = useState<RedeemableVoucher | null>(
    null
  )

  const handleLookup = useCallback(async () => {
    if (!code.trim()) {
      setError("Please enter a voucher code")
      return
    }

    setIsLookingUp(true)
    setError(null)
    setFoundVoucher(null)
    setRedeemedVoucher(null)

    try {
      const result = await lookupVoucherByCode(code.trim().toUpperCase())
      if (result.success && result.data) {
        const voucher = result.data.voucher
        // Check if voucher belongs to this campaign
        if (voucher.status !== "claimed") {
          setError(`Voucher is ${voucher.status}, cannot be redeemed`)
          return
        }
        setFoundVoucher(voucher)
      } else {
        setError(result.error || "Voucher not found")
      }
    } catch (err) {
      console.error("Error looking up voucher:", err)
      setError("An unexpected error occurred")
    } finally {
      setIsLookingUp(false)
    }
  }, [code])

  const handleRedeem = useCallback(async () => {
    if (!foundVoucher) return

    setIsRedeeming(true)
    try {
      const result = await redeemVoucher({
        code: foundVoucher.code,
        redemptionMethod: "manual_entry",
      })
      if (result.success && result.data) {
        setRedeemedVoucher(result.data.voucher)
        setFoundVoucher(null)
        setCode("")
        addNotification("Voucher redeemed successfully!", "success")
      } else {
        setError(result.error || "Failed to redeem voucher")
      }
    } catch (err) {
      console.error("Error redeeming voucher:", err)
      setError("An unexpected error occurred")
    } finally {
      setIsRedeeming(false)
    }
  }, [foundVoucher, addNotification])

  const handleReset = useCallback(() => {
    setCode("")
    setFoundVoucher(null)
    setRedeemedVoucher(null)
    setError(null)
  }, [])

  const getDiscountLabel = (voucher: RedeemableVoucher) => {
    switch (voucher.discountType) {
      case "percentage":
        return `${voucher.discountValue}% off`
      case "fixed_amount":
        return `₱${voucher.discountValue} off`
      case "free_item":
        return voucher.freeItemName || "Free Item"
      default:
        return "Discount"
    }
  }

  const getDiscountIcon = (type: RedeemableVoucher["discountType"]) => {
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

  return (
    <div className="bg-background rounded-xl border border-text/10 p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <ScanLine className="w-5 h-5 text-primary" />
        Redeem Voucher
      </h3>

      {/* Input Section */}
      {!foundVoucher && !redeemedVoucher && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Enter Voucher Code
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  placeholder="e.g., GROUNDS-ABCD-1234"
                  className="w-full pl-10 pr-4 py-2.5 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono uppercase"
                  disabled={isLookingUp}
                />
              </div>
              <button
                onClick={handleLookup}
                disabled={isLookingUp || !code.trim()}
                className="px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isLookingUp ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Look Up
              </button>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Found Voucher Preview */}
      <AnimatePresence>
        {foundVoucher && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-800">Voucher Found</p>
                  <p className="text-sm text-green-600">
                    Review the details below before redeeming.
                  </p>
                </div>
              </div>
            </div>

            {/* Voucher Details Card */}
            <div className="p-4 bg-text/5 rounded-lg border border-text/10">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    foundVoucher.discountType === "percentage"
                      ? "bg-purple-100 text-purple-700"
                      : foundVoucher.discountType === "free_item"
                        ? "bg-pink-100 text-pink-700"
                        : "bg-blue-100 text-blue-700"
                  )}
                >
                  {getDiscountIcon(foundVoucher.discountType)}
                </div>
                <div>
                  <p className="font-semibold text-lg">{getDiscountLabel(foundVoucher)}</p>
                  <p className="text-sm text-text/60">
                    {foundVoucher.campaignName}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text/60">Code</span>
                  <p className="font-mono">{foundVoucher.code}</p>
                </div>
                <div>
                  <span className="text-text/60">Status</span>
                  <p className="capitalize">{foundVoucher.status}</p>
                </div>
                <div>
                  <span className="text-text/60">Valid From</span>
                  <p>
                    {new Date(foundVoucher.startDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-text/60">Valid Until</span>
                  <p>{new Date(foundVoucher.endDate).toLocaleDateString()}</p>
                </div>
              </div>

              {foundVoucher.description && (
                <div className="mt-4 pt-4 border-t border-text/10">
                  <span className="text-text/60 text-sm">Description</span>
                  <p className="text-sm mt-1">{foundVoucher.description}</p>
                </div>
              )}

              {foundVoucher.termsAndConditions && (
                <div className="mt-3">
                  <span className="text-text/60 text-sm">Terms & Conditions</span>
                  <p className="text-sm mt-1">{foundVoucher.termsAndConditions}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setFoundVoucher(null)
                  setError(null)
                }}
                className="flex-1 px-4 py-2.5 bg-text/10 rounded-lg font-medium hover:bg-text/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRedeem}
                disabled={isRedeeming}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isRedeeming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redeeming...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm Redemption
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Redemption Success */}
      <AnimatePresence>
        {redeemedVoucher && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center py-6"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h4 className="text-xl font-semibold mb-2">Voucher Redeemed!</h4>
            <p className="text-text/60 mb-4">
              The voucher <code className="font-mono bg-text/10 px-1 rounded">{redeemedVoucher.code}</code> has been successfully redeemed.
            </p>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Redeem Another
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
