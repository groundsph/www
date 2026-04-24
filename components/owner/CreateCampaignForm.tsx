"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import {
  ArrowLeft,
  Save,
  Loader2,
  Percent,
  Gift,
  Ticket,
  Calendar,
  Users,
  Lock,
  QrCode,
  FileText,
  AlertCircle,
  Check,
  Tag,
  Hash,
  CreditCard,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/utils/cn"
import { createCampaign } from "@/app/api/actions/discount"
import { createCampaignSchema } from "@/utils/validation/discount"

type FormData = {
  name: string
  description: string
  discountType: "percentage" | "fixed_amount" | "free_item"
  discountValue: number
  freeItemName: string
  freeItemDescription: string
  maxRedemptions: number
  maxPerUser: number
  minPurchaseAmount: number | null
  codePrefix: string
  startDate: string
  endDate: string
  isPublic: boolean
  qrCodeEnabled: boolean
  termsAndConditions: string
}

const DEFAULT_FORM: FormData = {
  name: "",
  description: "",
  discountType: "percentage",
  discountValue: 10,
  freeItemName: "",
  freeItemDescription: "",
  maxRedemptions: 100,
  maxPerUser: 1,
  minPurchaseAmount: null,
  codePrefix: "GROUNDS",
  startDate: "",
  endDate: "",
  isPublic: true,
  qrCodeEnabled: true,
  termsAndConditions: "",
}

interface CreateCampaignFormProps {
  cafeId: string
  cafeName: string
  cafeSlug: string
}

export default function CreateCampaignForm({
  cafeId,
  cafeName,
  cafeSlug,
}: CreateCampaignFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Set default dates on mount
  useState(() => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextMonth = new Date(now)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    const formatDateTimeLocal = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      const hours = String(date.getHours()).padStart(2, "0")
      const minutes = String(date.getMinutes()).padStart(2, "0")
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    setForm((prev) => ({
      ...prev,
      startDate: formatDateTimeLocal(tomorrow),
      endDate: formatDateTimeLocal(nextMonth),
    }))
  })

  const handleInputChange = useCallback(
    (field: keyof FormData, value: string | number | boolean | null) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      // Clear error for this field when user types
      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors[field]
          return newErrors
        })
      }
    },
    [errors]
  )

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}

    try {
      // Prepare data for validation
      const validationData = {
        ...form,
        discountValue: Number(form.discountValue),
        maxRedemptions: Number(form.maxRedemptions),
        maxPerUser: Number(form.maxPerUser),
        minPurchaseAmount:
          form.minPurchaseAmount !== null && form.minPurchaseAmount !== undefined
            ? Number(form.minPurchaseAmount)
            : undefined,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      }

      const result = createCampaignSchema.safeParse(validationData)

      if (!result.success) {
        result.error.issues.forEach((err) => {
          const field = String(err.path[0])
          newErrors[field] = err.message
        })
      }
    } catch {
      newErrors.general = "Validation error occurred"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [form])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitError(null)

      if (!validate()) return

      setSubmitting(true)

      try {
        const result = await createCampaign(cafeId, {
          name: form.name,
          description: form.description || undefined,
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          freeItemName: form.discountType === "free_item" ? form.freeItemName : undefined,
          freeItemDescription: form.discountType === "free_item" ? form.freeItemDescription : undefined,
          maxRedemptions: Number(form.maxRedemptions),
          maxPerUser: Number(form.maxPerUser),
          minPurchaseAmount:
            form.minPurchaseAmount !== null && form.minPurchaseAmount !== undefined
              ? Number(form.minPurchaseAmount)
              : undefined,
          codePrefix: form.codePrefix,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
          isPublic: form.isPublic,
          qrCodeEnabled: form.qrCodeEnabled,
          termsAndConditions: form.termsAndConditions || undefined,
        })

        if (result.success) {
          router.push(`/owner/cafes/${cafeSlug}/discounts`)
        } else {
          setSubmitError(result.error || "Failed to create campaign")
        }
      } catch (error) {
        console.error("Error creating campaign:", error)
        setSubmitError("An unexpected error occurred. Please try again.")
      } finally {
        setSubmitting(false)
      }
    },
    [form, cafeId, cafeSlug, validate, router]
  )

  const handleCancel = useCallback(() => {
    router.push(`/owner/cafes/${cafeSlug}/discounts`)
  }, [router, cafeSlug])

  const discountTypes = [
    {
      value: "percentage" as const,
      label: "Percentage Off",
      icon: Percent,
      description: "e.g., 20% off total bill",
    },
    {
      value: "fixed_amount" as const,
      label: "Fixed Amount Off",
      icon: Ticket,
      description: "e.g., ₱100 off total bill",
    },
    {
      value: "free_item" as const,
      label: "Free Item",
      icon: Gift,
      description: "e.g., Free pastry with coffee",
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/owner/cafes/${cafeSlug}/discounts`}
          className="p-2 hover:bg-text/10 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="text-sm text-text/60 mb-1">
            <Link
              href={`/owner/cafes/${cafeSlug}`}
              className="hover:text-primary transition-colors"
            >
              {cafeName}
            </Link>
            {" / "}
            <Link
              href={`/owner/cafes/${cafeSlug}/discounts`}
              className="hover:text-primary transition-colors"
            >
              Discounts
            </Link>
          </div>
          <h1 className="text-2xl font-bold">Create Campaign</h1>
        </div>
      </div>

      {/* Error Banner */}
      {submitError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{submitError}</p>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            Basic Information
          </h2>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Campaign Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="e.g., Summer Special 2026"
              className={cn(
                "w-full px-3 py-2.5 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all",
                errors.name ? "border-red-300" : "border-text/10"
              )}
            />
            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Describe the campaign (optional)"
              rows={3}
              className="w-full px-3 py-2.5 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
            />
          </div>
        </section>

        {/* Discount Type */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Percent className="w-5 h-5 text-primary" />
            Discount Type
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {discountTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleInputChange("discountType", type.value)}
                className={cn(
                  "p-4 border rounded-xl text-left transition-all",
                  form.discountType === type.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-text/10 hover:border-text/20"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <type.icon className="w-5 h-5 text-primary" />
                  <span className="font-medium">{type.label}</span>
                  {form.discountType === type.value && (
                    <Check className="w-4 h-4 text-primary ml-auto" />
                  )}
                </div>
                <p className="text-xs text-text/60">{type.description}</p>
              </button>
            ))}
          </div>

          {/* Discount Value */}
          {form.discountType !== "free_item" && (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Discount Value <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step={form.discountType === "percentage" ? "1" : "0.01"}
                  value={form.discountValue}
                  onChange={(e) =>
                    handleInputChange("discountValue", e.target.value)
                  }
                  placeholder={form.discountType === "percentage" ? "20" : "100"}
                  className={cn(
                    "w-full px-3 py-2.5 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all",
                    errors.discountValue ? "border-red-300" : "border-text/10"
                  )}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text/40 text-sm">
                  {form.discountType === "percentage" ? "%" : "₱"}
                </span>
              </div>
              {errors.discountValue && (
                <p className="text-sm text-red-500 mt-1">{errors.discountValue}</p>
              )}
              {form.discountType === "percentage" && (
                <p className="text-xs text-text/60 mt-1">
                  Enter a value between 1 and 100
                </p>
              )}
            </div>
          )}

          {/* Free Item Fields */}
          {form.discountType === "free_item" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Free Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.freeItemName}
                  onChange={(e) => handleInputChange("freeItemName", e.target.value)}
                  placeholder="e.g., Chocolate Croissant"
                  className={cn(
                    "w-full px-3 py-2.5 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all",
                    errors.freeItemName ? "border-red-300" : "border-text/10"
                  )}
                />
                {errors.freeItemName && (
                  <p className="text-sm text-red-500 mt-1">{errors.freeItemName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Free Item Description
                </label>
                <textarea
                  value={form.freeItemDescription}
                  onChange={(e) =>
                    handleInputChange("freeItemDescription", e.target.value)
                  }
                  placeholder="e.g., Any pastry from our display case (optional)"
                  rows={2}
                  className="w-full px-3 py-2.5 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
                />
              </div>
            </motion.div>
          )}
        </section>

        {/* Campaign Limits */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Campaign Limits
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Max Redemptions */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Max Total Redemptions <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40" />
                <input
                  type="number"
                  min="1"
                  value={form.maxRedemptions}
                  onChange={(e) =>
                    handleInputChange("maxRedemptions", e.target.value)
                  }
                  className={cn(
                    "w-full pl-10 pr-3 py-2.5 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all",
                    errors.maxRedemptions ? "border-red-300" : "border-text/10"
                  )}
                />
              </div>
              {errors.maxRedemptions && (
                <p className="text-sm text-red-500 mt-1">{errors.maxRedemptions}</p>
              )}
            </div>

            {/* Max Per User */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Max Per User
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40" />
                <input
                  type="number"
                  min="1"
                  value={form.maxPerUser}
                  onChange={(e) => handleInputChange("maxPerUser", e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
              <p className="text-xs text-text/60 mt-1">
                How many times one customer can redeem
              </p>
            </div>
          </div>

          {/* Min Purchase Amount */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Minimum Purchase Amount
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.minPurchaseAmount ?? ""}
                onChange={(e) =>
                  handleInputChange(
                    "minPurchaseAmount",
                    e.target.value ? parseFloat(e.target.value) : null
                  )
                }
                placeholder="No minimum"
                className="w-full pl-10 pr-3 py-2.5 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text/40 text-sm">
                ₱
              </span>
            </div>
            <p className="text-xs text-text/60 mt-1">
              Leave empty for no minimum purchase requirement
            </p>
          </div>
        </section>

        {/* Campaign Settings */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Campaign Schedule
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
                className={cn(
                  "w-full px-3 py-2.5 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all",
                  errors.startDate ? "border-red-300" : "border-text/10"
                )}
              />
              {errors.startDate && (
                <p className="text-sm text-red-500 mt-1">{errors.startDate}</p>
              )}
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => handleInputChange("endDate", e.target.value)}
                className={cn(
                  "w-full px-3 py-2.5 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all",
                  errors.endDate ? "border-red-300" : "border-text/10"
                )}
              />
              {errors.endDate && (
                <p className="text-sm text-red-500 mt-1">{errors.endDate}</p>
              )}
            </div>
          </div>
        </section>

        {/* Voucher Settings */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            Voucher Settings
          </h2>

          {/* Code Prefix */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Code Prefix</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40" />
              <input
                type="text"
                value={form.codePrefix}
                onChange={(e) => handleInputChange("codePrefix", e.target.value)}
                placeholder="GROUNDS"
                className="w-full pl-10 pr-3 py-2.5 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            <p className="text-xs text-text/60 mt-1">
              Generated codes will look like: {form.codePrefix || "GROUNDS"}-XXXX-XXXX
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            {/* Public Toggle */}
            <label className="flex items-start gap-3 p-3 bg-text/5 rounded-lg cursor-pointer hover:bg-text/10 transition-colors">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={(e) => handleInputChange("isPublic", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-text/20 rounded-full peer peer-checked:bg-primary transition-colors" />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:left-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-text/60" />
                  <span className="font-medium">Public Campaign</span>
                </div>
                <p className="text-sm text-text/60 mt-0.5">
                  Allow customers to discover and claim vouchers from this campaign
                </p>
              </div>
            </label>

            {/* QR Code Toggle */}
            <label className="flex items-start gap-3 p-3 bg-text/5 rounded-lg cursor-pointer hover:bg-text/10 transition-colors">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={form.qrCodeEnabled}
                  onChange={(e) =>
                    handleInputChange("qrCodeEnabled", e.target.checked)
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-text/20 rounded-full peer peer-checked:bg-primary transition-colors" />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:left-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-text/60" />
                  <span className="font-medium">QR Code Enabled</span>
                </div>
                <p className="text-sm text-text/60 mt-0.5">
                  Allow redemption via QR code scanning
                </p>
              </div>
            </label>
          </div>
        </section>

        {/* Terms and Conditions */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Terms and Conditions
          </h2>

          <div>
            <textarea
              value={form.termsAndConditions}
              onChange={(e) =>
                handleInputChange("termsAndConditions", e.target.value)
              }
              placeholder="e.g., Valid for dine-in only. Cannot be combined with other offers. (optional)"
              rows={4}
              className="w-full px-3 py-2.5 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
            />
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-text/10">
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="px-6 py-2.5 bg-text/10 rounded-lg font-medium hover:bg-text/20 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Campaign...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Create Campaign
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  )
}
