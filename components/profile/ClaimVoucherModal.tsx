"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Ticket, Loader2 } from "lucide-react"
import { claimVoucher } from "@/app/api/actions/discount"

interface ClaimVoucherModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ClaimVoucherModal({ isOpen, onClose, onSuccess }: ClaimVoucherModalProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await claimVoucher({ code: code.trim().toUpperCase() })

    if (result.success) {
      setCode("")
      onSuccess()
      onClose()
    } else {
      setError(result.error ?? "Failed to claim voucher")
    }

    setIsSubmitting(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-card rounded-xl border border-border p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Claim Voucher</h2>
              <button onClick={onClose} className="p-1 hover:bg-text/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Voucher Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="GROUNDS-XXXX-XXXX"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono text-center text-lg tracking-wider"
                  maxLength={20}
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={!code.trim() || isSubmitting}
                className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Ticket className="w-4 h-4" />
                )}
                {isSubmitting ? "Claiming..." : "Claim Voucher"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
