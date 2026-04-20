"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check } from "lucide-react"
import { motion } from "motion/react"

interface CampaignQRCodeProps {
  campaignId: string
  campaignName: string
  baseUrl: string
}

export default function CampaignQRCode({
  campaignId,
  campaignName,
  baseUrl,
}: CampaignQRCodeProps) {
  const [copied, setCopied] = useState(false)

  const claimUrl = `${baseUrl}/api/discount/claim/${campaignId}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(claimUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-6 text-center space-y-4"
    >
      <h3 className="font-bold text-lg">{campaignName}</h3>
      <p className="text-sm text-text/60">
        Scan this QR code to claim your voucher
      </p>
      <div className="flex justify-center">
        <div className="bg-white p-4 rounded-xl">
          <QRCodeSVG
            value={claimUrl}
            size={200}
            level="M"
            includeMargin={false}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-center">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-text/10 rounded-lg text-sm font-medium hover:bg-text/20 transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </motion.div>
  )
}
