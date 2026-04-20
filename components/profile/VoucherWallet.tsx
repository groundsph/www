"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Ticket, Plus, Search } from "lucide-react"
import { UserVoucher } from "@/utils/types/discount"
import VoucherCard from "./VoucherCard"

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

      {/* Enter Code Modal */}
      <AnimatePresence>
        {isEnterCodeModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEnterCodeModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md md:w-full bg-background rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-text/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Ticket className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg">Enter Voucher Code</h2>
                    <p className="text-sm text-text/60">Claim a voucher with a code</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="bg-text/5 border border-text/10 rounded-lg p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Search className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-text/60 font-medium">Coming Soon</p>
                  <p className="text-sm text-text/40 mt-1">
                    This feature is currently under development.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-text/10">
                <button
                  onClick={() => setIsEnterCodeModalOpen(false)}
                  className="w-full px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
