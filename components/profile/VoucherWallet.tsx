"use client"

import { useState, useMemo, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { Ticket, Plus, Search, Gift } from "lucide-react"
import { UserVoucher } from "@/utils/types/discount"
import { claimVoucherFromCampaign } from "@/app/api/actions/discount"
import VoucherCard from "./VoucherCard"
import ClaimVoucherModal from "./ClaimVoucherModal"

interface VoucherWalletProps {
  vouchers: UserVoucher[]
}

type TabType = "active" | "used"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 25,
    },
  },
}

export default function VoucherWallet({ vouchers }: VoucherWalletProps) {
  const [activeTab, setActiveTab] = useState<TabType>("active")
  const [isEnterCodeModalOpen, setIsEnterCodeModalOpen] = useState(false)
  const [isClaimingCampaign, setIsClaimingCampaign] = useState(false)
  const [campaignError, setCampaignError] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const claimCampaignId = searchParams.get("claim")

  // Handle QR scan claim flow - claim from campaign
  const handleCampaignClaim = useCallback(async () => {
    if (!claimCampaignId) return

    setIsClaimingCampaign(true)
    setCampaignError(null)

    const result = await claimVoucherFromCampaign({ campaignId: claimCampaignId })

    if (result.success) {
      // Remove the query param and refresh to show new voucher
      router.replace("/profile/vouchers")
      router.refresh()
    } else {
      setCampaignError(result.error ?? "Failed to claim voucher")
      setIsClaimingCampaign(false)
    }
  }, [claimCampaignId, router])

  const dismissCampaignError = useCallback(() => {
    setCampaignError(null)
    router.replace("/profile/vouchers")
  }, [router])

  // Filter vouchers by status
  const activeVouchers = useMemo(
    () => vouchers.filter((v) => v.status === "claimed"),
    [vouchers]
  )

  const usedVouchers = useMemo(
    () => vouchers.filter((v) => v.status === "redeemed"),
    [vouchers]
  )

  const displayedVouchers = activeTab === "active" ? activeVouchers : usedVouchers

  const handleClaimSuccess = () => {
    // Refresh the page to show new voucher
    router.refresh()
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif">My Vouchers</h1>
          <p className="text-text/60 mt-1">
            Manage your discount vouchers and promotions
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsEnterCodeModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Enter Code
        </motion.button>
      </div>

      {/* QR Scan Campaign Claim Banner */}
      {claimCampaignId && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6"
          >
            {campaignError ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-red-500 font-medium">{campaignError}</p>
                <button
                  onClick={dismissCampaignError}
                  className="text-sm text-red-500/80 hover:text-red-500 underline mt-1"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Gift className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-primary">Claim Voucher</p>
                    <p className="text-sm text-primary/70 mt-0.5">
                      You scanned a QR code for a voucher. Claim it now?
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleCampaignClaim}
                        disabled={isClaimingCampaign}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isClaimingCampaign ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Claiming...
                          </>
                        ) : (
                          <>
                            <Ticket className="w-4 h-4" />
                            Claim Now
                          </>
                        )}
                      </button>
                      <button
                        onClick={dismissCampaignError}
                        className="px-4 py-2 bg-background text-text/70 rounded-lg font-medium text-sm hover:bg-text/5 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-linear-to-br from-primary/10 to-secondary/10 border border-primary/20 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Ticket className="w-4 h-4 text-primary" />
            <span className="text-sm text-text/60">Active</span>
          </div>
          <p className="text-2xl font-bold">{activeVouchers.length}</p>
        </motion.div>
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-linear-to-br from-text/5 to-text/10 border border-text/10 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Ticket className="w-4 h-4 text-text/40" />
            <span className="text-sm text-text/60">Used</span>
          </div>
          <p className="text-2xl font-bold text-text/70">{usedVouchers.length}</p>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-text/5 rounded-xl mb-6">
        <button
          onClick={() => setActiveTab("active")}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
            activeTab === "active"
              ? "bg-background text-primary shadow-sm"
              : "text-text/60 hover:text-text"
          }`}
        >
          Active ({activeVouchers.length})
        </button>
        <button
          onClick={() => setActiveTab("used")}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
            activeTab === "used"
              ? "bg-background text-primary shadow-sm"
              : "text-text/60 hover:text-text"
          }`}
        >
          Used ({usedVouchers.length})
        </button>
      </div>

      {/* Voucher List */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0 }}
          className="space-y-4"
        >
          {displayedVouchers.length > 0 ? (
            displayedVouchers.map((voucher) => (
              <motion.div key={voucher.id} variants={itemVariants}>
                <VoucherCard voucher={voucher} />
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-16 px-4 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-text/5 flex items-center justify-center mb-4">
                {activeTab === "active" ? (
                  <Ticket className="w-8 h-8 text-text/20" />
                ) : (
                  <Search className="w-8 h-8 text-text/20" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {activeTab === "active" ? "No active vouchers" : "No used vouchers"}
              </h3>
              <p className="text-text/60 max-w-sm">
                {activeTab === "active"
                  ? "You don't have any active vouchers. Claim vouchers from cafes or enter a voucher code to get started."
                  : "You haven't redeemed any vouchers yet. Once you use a voucher, it will appear here."}
              </p>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Claim Voucher Modal */}
      <ClaimVoucherModal
        isOpen={isEnterCodeModalOpen}
        onClose={() => setIsEnterCodeModalOpen(false)}
        onSuccess={handleClaimSuccess}
      />
    </div>
  )
}
