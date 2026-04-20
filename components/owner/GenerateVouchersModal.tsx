"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  X,
  Copy,
  Check,
  Ticket,
  AlertCircle,
  Loader2,
  Hash,
  Download,
} from "lucide-react"
import { generateVouchers } from "@/app/api/actions/discount"

interface GenerateVouchersModalProps {
  open: boolean
  onClose: () => void
  campaignId: string
  maxVouchers: number
  existingVouchers: number
}

export default function GenerateVouchersModal({
  open,
  onClose,
  campaignId,
  maxVouchers,
  existingVouchers,
}: GenerateVouchersModalProps) {
  const [count, setCount] = useState<number>(10)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedVouchers, setGeneratedVouchers] = useState<
    { id: string; code: string }[] | null
  >(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const remainingCapacity = maxVouchers - existingVouchers

  const handleCountChange = useCallback((value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 1 && num <= 1000) {
      setCount(Math.min(num, remainingCapacity))
    }
  }, [remainingCapacity])

  const handleGenerate = useCallback(async () => {
    if (count < 1 || count > remainingCapacity) {
      setError(`Please enter a number between 1 and ${remainingCapacity}`)
      return
    }

    setGenerating(true)
    setError(null)

    try {
      const result = await generateVouchers({
        campaignId,
        count,
      })

      if (result.success && result.data?.vouchers) {
        setGeneratedVouchers(result.data.vouchers)
      } else {
        setError(result.error || "Failed to generate vouchers")
      }
    } catch (err) {
      console.error("Error generating vouchers:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setGenerating(false)
    }
  }, [count, campaignId, remainingCapacity])

  const handleCopy = useCallback(async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }, [])

  const handleCopyAll = useCallback(async () => {
    if (!generatedVouchers) return
    const allCodes = generatedVouchers.map((v) => v.code).join("\n")
    try {
      await navigator.clipboard.writeText(allCodes)
    } catch {
      // Fallback
    }
  }, [generatedVouchers])

  const handleDownload = useCallback(() => {
    if (!generatedVouchers) return
    const csv = generatedVouchers.map((v) => v.code).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vouchers-${campaignId.slice(0, 8)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [generatedVouchers, campaignId])

  const handleClose = useCallback(() => {
    if (generatedVouchers) {
      // Reset state when closing after generation
      setGeneratedVouchers(null)
      setCount(10)
      setError(null)
    }
    onClose()
  }, [generatedVouchers, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-background rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Ticket className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Generate Vouchers</h2>
              <p className="text-sm text-text/60">
                {remainingCapacity.toLocaleString()} vouchers remaining
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-text/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {!generatedVouchers ? (
          /* Generation Form */
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="bg-text/5 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text/60">Existing</span>
                <span className="font-medium">{existingVouchers.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-text/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: `${(existingVouchers / maxVouchers) * 100}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text/60">Remaining capacity</span>
                <span className="font-medium text-primary">
                  {remainingCapacity.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Count Input */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Number of Vouchers to Generate
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40" />
                <input
                  type="number"
                  min="1"
                  max={Math.min(1000, remainingCapacity)}
                  value={count}
                  onChange={(e) => handleCountChange(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  placeholder="10"
                />
              </div>
              <p className="text-xs text-text/60 mt-1">
                Max {Math.min(1000, remainingCapacity).toLocaleString()} at a time
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 bg-text/10 rounded-lg font-medium hover:bg-text/20 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || count < 1 || count > remainingCapacity}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Ticket className="w-4 h-4" />
                    Generate {count} Voucher{count !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Generated Vouchers Display */
          <div className="space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                Successfully generated {generatedVouchers.length} voucher
                {generatedVouchers.length !== 1 ? "s" : ""}!
              </p>
            </div>

            {/* Bulk Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleCopyAll}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-text/5 hover:bg-text/10 rounded-lg text-sm font-medium transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy All
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-text/5 hover:bg-text/10 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </button>
            </div>

            {/* Voucher List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {generatedVouchers.map((voucher, index) => (
                <motion.div
                  key={voucher.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 p-3 bg-text/5 rounded-lg"
                >
                  <span className="text-xs text-text/40 w-6">{index + 1}</span>
                  <code className="flex-1 font-mono text-sm">{voucher.code}</code>
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
                </motion.div>
              ))}
            </div>

            {/* Done Button */}
            <button
              onClick={handleClose}
              className="w-full px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition"
            >
              Done
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
