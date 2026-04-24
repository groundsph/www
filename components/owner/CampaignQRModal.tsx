"use client"

import { motion, AnimatePresence } from "motion/react"
import { X } from "lucide-react"
import CampaignQRCode from "./CampaignQRCode"

interface CampaignQRModalProps {
  isOpen: boolean
  onClose: () => void
  campaignId: string
  campaignName: string
  baseUrl: string
}

export default function CampaignQRModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
  baseUrl,
}: CampaignQRModalProps) {
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
            className="bg-card rounded-xl border border-border p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Campaign QR Code</h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-text/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <CampaignQRCode
              campaignId={campaignId}
              campaignName={campaignName}
              baseUrl={baseUrl}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
