"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import {
    CafeMenuItem,
    CafeSubscription,
    MenuItemForm,
    OwnerReviewResponse,
    SUBSCRIPTION_TIERS,
    SubscriptionTier,
} from "@/utils/types/owner"
import { motion, AnimatePresence } from "motion/react"
import {
    ArrowLeft,
    BarChart3,
    Building2,
    Check,
    ChevronRight,
    Crown,
    Edit2,
    ExternalLink,
    Loader2,
    MessageSquare,
    Plus,
    Send,
    Settings,
    Star,
    Trash2,
    UtensilsCrossed,
    Verified,
    X,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import {
    respondToReview,
    deleteReviewResponse,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
} from "@/app/api/actions/owner"
import { useNotification } from "@/components/NotificationProvider"
import { getCafeThumbnailUrl } from "@/utils/extras"

interface CafeManagementClientProps {
    cafe: CafeWithRatings
    subscription: CafeSubscription | null
    reviews: {
        id: string
        rating: number
        comment: string
        created_at: string | null
        author: {
            id: string
            username: string
            display_name: string
            avatar_url: string | null
        }
        owner_response: OwnerReviewResponse | null
    }[]
    menuItems: CafeMenuItem[]
}

// Tier badge colors
const tierColors: Record<
    SubscriptionTier,
    { bg: string; text: string; border: string }
> = {
    free: {
        bg: "bg-gray-100",
        text: "text-gray-600",
        border: "border-gray-200",
    },
    pro: {
        bg: "bg-blue-100",
        text: "text-blue-700",
        border: "border-blue-200",
    },
    premium: {
        bg: "bg-amber-100",
        text: "text-amber-700",
        border: "border-amber-200",
    },
}

type Tab = "overview" | "reviews" | "menu" | "analytics" | "settings"

export default function CafeManagementClient({
    cafe,
    subscription,
    reviews: initialReviews,
    menuItems: initialMenuItems,
}: CafeManagementClientProps) {
    const { addNotification } = useNotification()
    const [activeTab, setActiveTab] = useState<Tab>("overview")
    const [reviews, setReviews] = useState(initialReviews)
    const [menuItems, setMenuItems] = useState(initialMenuItems)

    // Response state
    const [respondingTo, setRespondingTo] = useState<string | null>(null)
    const [responseText, setResponseText] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Menu management state
    const [showMenuModal, setShowMenuModal] = useState(false)
    const [editingMenuItem, setEditingMenuItem] = useState<CafeMenuItem | null>(
        null
    )
    const [menuForm, setMenuForm] = useState<MenuItemForm>({
        name: "",
        category: "Coffee",
        price: 0,
        description: "",
        is_signature: false,
        is_available: true,
    })

    const tier = subscription?.tier || "free"
    const tierConfig = SUBSCRIPTION_TIERS[tier]
    const colors = tierColors[tier]

    // Handle review response
    const handleSubmitResponse = async (reviewId: string) => {
        if (!responseText.trim()) return

        setIsSubmitting(true)
        const result = await respondToReview({
            review_id: reviewId,
            response: responseText,
        })

        if (result.success) {
            setReviews((prev) =>
                prev.map((r) =>
                    r.id === reviewId
                        ? {
                              ...r,
                              owner_response: {
                                  id: "temp",
                                  review_id: reviewId,
                                  owner_id: "",
                                  response: responseText,
                                  created_at: new Date().toISOString(),
                                  updated_at: new Date().toISOString(),
                                  is_edited: false,
                              },
                          }
                        : r
                )
            )
            setRespondingTo(null)
            setResponseText("")
            addNotification("Response submitted successfully", "success")
        } else {
            addNotification(
                result.error || "Failed to submit response",
                "error"
            )
        }
        setIsSubmitting(false)
    }

    // Handle delete response
    const handleDeleteResponse = async (
        reviewId: string,
        responseId: string
    ) => {
        if (!confirm("Are you sure you want to delete this response?")) return

        const result = await deleteReviewResponse(responseId)
        if (result.success) {
            setReviews((prev) =>
                prev.map((r) =>
                    r.id === reviewId ? { ...r, owner_response: null } : r
                )
            )
            addNotification("Response deleted", "success")
        } else {
            addNotification(
                result.error || "Failed to delete response",
                "error"
            )
        }
    }

    // Menu handlers
    const openAddMenu = () => {
        setEditingMenuItem(null)
        setMenuForm({
            name: "",
            category: "Coffee",
            price: 0,
            description: "",
            is_signature: false,
            is_available: true,
        })
        setShowMenuModal(true)
    }

    const openEditMenu = (item: CafeMenuItem) => {
        setEditingMenuItem(item)
        setMenuForm({
            name: item.name,
            category: item.category,
            price: item.price,
            description: item.description || "",
            is_signature: item.is_signature,
            is_available: item.is_available,
        })
        setShowMenuModal(true)
    }

    const handleSaveMenuItem = async () => {
        if (!menuForm.name.trim()) {
            addNotification("Please enter a name", "error")
            return
        }
        if (menuForm.price <= 0) {
            addNotification("Please enter a valid price", "error")
            return
        }

        setIsSubmitting(true)

        if (editingMenuItem) {
            // Update existing
            const result = await updateMenuItem(editingMenuItem.id, menuForm)
            if (result.success) {
                setMenuItems((prev) =>
                    prev.map((item) =>
                        item.id === editingMenuItem.id
                            ? { ...item, ...menuForm }
                            : item
                    )
                )
                addNotification("Menu item updated", "success")
                setShowMenuModal(false)
            } else {
                addNotification(result.error || "Failed to update", "error")
            }
        } else {
            // Add new
            const result = await addMenuItem(cafe.id, menuForm)
            if (result.success && result.item) {
                setMenuItems((prev) => [...prev, result.item!])
                addNotification("Menu item added", "success")
                setShowMenuModal(false)
            } else {
                addNotification(result.error || "Failed to add", "error")
            }
        }

        setIsSubmitting(false)
    }

    const handleDeleteMenuItem = async (itemId: string) => {
        if (!confirm("Delete this menu item?")) return

        const result = await deleteMenuItem(itemId)
        if (result.success) {
            setMenuItems((prev) => prev.filter((item) => item.id !== itemId))
            addNotification("Menu item deleted", "success")
        } else {
            addNotification(result.error || "Failed to delete", "error")
        }
    }

    const tabs = [
        { id: "overview" as Tab, label: "Overview", icon: Building2 },
        {
            id: "reviews" as Tab,
            label: "Reviews",
            icon: MessageSquare,
            badge: reviews.filter((r) => !r.owner_response).length,
        },
        {
            id: "menu" as Tab,
            label: "Menu",
            icon: UtensilsCrossed,
            locked: tier === "free",
        },
        {
            id: "analytics" as Tab,
            label: "Analytics",
            icon: BarChart3,
            locked: tier === "free",
        },
        { id: "settings" as Tab, label: "Settings", icon: Settings },
    ]

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {/* Back Button */}
                <Link
                    href='/owner'
                    className='inline-flex items-center gap-1 text-text/60 hover:text-text mb-4 transition-colors'
                >
                    <ArrowLeft className='w-4 h-4' />
                    Back to Dashboard
                </Link>

                {/* Header */}
                <div className='flex flex-col md:flex-row gap-4 md:gap-6 mb-6'>
                    {/* Thumbnail */}
                    <div className='relative w-full md:w-48 h-32 md:h-32 rounded-xl overflow-hidden bg-text/10 shrink-0'>
                        {cafe.thumbnail ? (
                            <Image
                                src={getCafeThumbnailUrl(cafe.thumbnail)}
                                alt={cafe.name}
                                fill
                                className='object-cover'
                            />
                        ) : (
                            <div className='w-full h-full flex items-center justify-center'>
                                <Building2 className='w-10 h-10 text-text/30' />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className='flex-1'>
                        <div className='flex items-start justify-between gap-4'>
                            <div>
                                <div className='flex items-center gap-2 flex-wrap'>
                                    <h1 className='text-2xl font-serif font-bold'>
                                        {cafe.name}
                                    </h1>
                                    <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
                                    >
                                        {tier === "premium" && (
                                            <Crown className='w-3 h-3' />
                                        )}
                                        {tier === "pro" && (
                                            <Verified className='w-3 h-3' />
                                        )}
                                        {tierConfig.name}
                                    </span>
                                </div>
                                <p className='text-text/60 mt-1'>
                                    {cafe.city_municipality}, {cafe.region}
                                </p>

                                {/* Quick Stats */}
                                <div className='flex items-center gap-4 mt-3 text-sm'>
                                    <span className='flex items-center gap-1'>
                                        <Star className='w-4 h-4 text-amber-500 fill-amber-500' />
                                        {cafe.average_rating?.toFixed(1) || "-"}
                                    </span>
                                    <span className='flex items-center gap-1 text-text/60'>
                                        <MessageSquare className='w-4 h-4' />
                                        {cafe.total_reviews || 0} reviews
                                    </span>
                                </div>
                            </div>

                            <Link
                                href={`/cafes/${cafe.slug}`}
                                target='_blank'
                                className='inline-flex items-center gap-1 px-3 py-2 bg-text/10 rounded-lg text-sm font-medium hover:bg-text/20 transition-colors'
                            >
                                <ExternalLink className='w-4 h-4' />
                                View Page
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className='border-b border-text/10 mb-6'>
                    <div className='flex gap-1 overflow-x-auto'>
                        {tabs.map((tab) => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id
                            const isLocked = tab.locked

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() =>
                                        !isLocked && setActiveTab(tab.id)
                                    }
                                    disabled={isLocked}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                        isActive
                                            ? "border-primary text-primary"
                                            : isLocked
                                              ? "border-transparent text-text/30 cursor-not-allowed"
                                              : "border-transparent text-text/60 hover:text-text hover:border-text/20"
                                    }`}
                                >
                                    <Icon className='w-4 h-4' />
                                    {tab.label}{" "}
                                    {tab.badge && tab.badge > 0 && (
                                        <span className='ml-1 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full'>
                                            {tab.badge}
                                        </span>
                                    )}
                                    {isLocked && (
                                        <span className='ml-1 text-xs bg-text/10 px-1.5 py-0.5 rounded'>
                                            Pro+
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Tab Content */}
                <AnimatePresence mode='wait'>
                    {activeTab === "overview" && (
                        <motion.div
                            key='overview'
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className='space-y-6'
                        >
                            {/* Subscription Status */}
                            <div className='p-6 bg-text/5 rounded-xl border border-text/10'>
                                <h3 className='font-semibold mb-4 flex items-center gap-2'>
                                    <Crown className='w-5 h-5 text-amber-500' />
                                    Subscription
                                </h3>
                                <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                                    <div>
                                        <p className='text-lg font-medium'>
                                            {tierConfig.name} Plan
                                        </p>
                                        <p className='text-text/60 text-sm'>
                                            {tierConfig.priceDisplay}
                                        </p>
                                        <ul className='mt-3 space-y-1 text-sm text-text/80'>
                                            {tierConfig.features.map(
                                                (feature, i) => (
                                                    <li
                                                        key={i}
                                                        className='flex items-center gap-2'
                                                    >
                                                        <Check className='w-4 h-4 text-green-500' />
                                                        {feature}
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    </div>
                                    {tier !== "premium" && (
                                        <Link
                                            href={`/owner/cafes/${cafe.id}/subscription`}
                                            className='inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors'
                                        >
                                            Upgrade
                                            <ChevronRight className='w-4 h-4' />
                                        </Link>
                                    )}
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                                <button
                                    onClick={() => setActiveTab("reviews")}
                                    className='p-4 bg-text/5 rounded-xl border border-text/10 hover:border-primary/30 transition-colors text-left'
                                >
                                    <MessageSquare className='w-6 h-6 text-primary mb-2' />
                                    <p className='font-medium'>
                                        Respond to Reviews
                                    </p>
                                    <p className='text-sm text-text/60'>
                                        {
                                            reviews.filter(
                                                (r) => !r.owner_response
                                            ).length
                                        }{" "}
                                        awaiting response
                                    </p>
                                </button>
                                <button
                                    onClick={() =>
                                        tier !== "free" && setActiveTab("menu")
                                    }
                                    disabled={tier === "free"}
                                    className={`p-4 bg-text/5 rounded-xl border border-text/10 text-left ${
                                        tier === "free"
                                            ? "opacity-50 cursor-not-allowed"
                                            : "hover:border-primary/30 transition-colors"
                                    }`}
                                >
                                    <UtensilsCrossed className='w-6 h-6 text-primary mb-2' />
                                    <p className='font-medium'>Manage Menu</p>
                                    <p className='text-sm text-text/60'>
                                        {tier === "free"
                                            ? "Upgrade to Pro"
                                            : `${menuItems.length} items`}
                                    </p>
                                </button>
                                <button
                                    onClick={() => setActiveTab("settings")}
                                    className='p-4 bg-text/5 rounded-xl border border-text/10 hover:border-primary/30 transition-colors text-left'
                                >
                                    <Settings className='w-6 h-6 text-primary mb-2' />
                                    <p className='font-medium'>Edit Details</p>
                                    <p className='text-sm text-text/60'>
                                        Update cafe info
                                    </p>
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "reviews" && (
                        <motion.div
                            key='reviews'
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className='space-y-4'
                        >
                            {reviews.length === 0 ? (
                                <div className='text-center py-12 text-text/60'>
                                    <MessageSquare className='w-12 h-12 mx-auto mb-3 opacity-30' />
                                    <p>No reviews yet</p>
                                </div>
                            ) : (
                                reviews.map((review) => (
                                    <div
                                        key={review.id}
                                        className='p-4 bg-text/5 rounded-xl border border-text/10'
                                    >
                                        {/* Review Header */}
                                        <div className='flex items-start justify-between gap-3'>
                                            <div className='flex items-center gap-3'>
                                                <div className='w-10 h-10 rounded-full bg-text/10 overflow-hidden'>
                                                    {review.author
                                                        .avatar_url ? (
                                                        <Image
                                                            src={
                                                                review.author
                                                                    .avatar_url
                                                            }
                                                            alt={
                                                                review.author
                                                                    .display_name
                                                            }
                                                            width={40}
                                                            height={40}
                                                            className='object-cover'
                                                        />
                                                    ) : (
                                                        <div className='w-full h-full flex items-center justify-center text-text/40'>
                                                            {
                                                                review.author
                                                                    .display_name[0]
                                                            }
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className='font-medium'>
                                                        {
                                                            review.author
                                                                .display_name
                                                        }
                                                    </p>
                                                    <div className='flex items-center gap-2 text-sm text-text/60'>
                                                        <span className='flex items-center gap-0.5'>
                                                            {Array.from({
                                                                length: 5,
                                                            }).map((_, i) => (
                                                                <Star
                                                                    key={i}
                                                                    className={`w-3.5 h-3.5 ${
                                                                        i <
                                                                        review.rating
                                                                            ? "text-amber-500 fill-amber-500"
                                                                            : "text-text/20"
                                                                    }`}
                                                                />
                                                            ))}
                                                        </span>
                                                        <span>•</span>
                                                        <span>
                                                            {review.created_at &&
                                                                new Date(
                                                                    review.created_at
                                                                ).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Review Content */}
                                        <p className='mt-3 text-text/80'>
                                            {review.comment}
                                        </p>

                                        {/* Owner Response */}
                                        {review.owner_response ? (
                                            <div className='mt-4 ml-4 p-3 bg-primary/5 rounded-lg border-l-2 border-primary'>
                                                <div className='flex items-center justify-between'>
                                                    <p className='text-sm font-medium text-primary'>
                                                        Your Response
                                                    </p>
                                                    <button
                                                        onClick={() =>
                                                            handleDeleteResponse(
                                                                review.id,
                                                                review
                                                                    .owner_response!
                                                                    .id
                                                            )
                                                        }
                                                        className='p-1 text-text/40 hover:text-red-500 transition-colors'
                                                    >
                                                        <Trash2 className='w-4 h-4' />
                                                    </button>
                                                </div>
                                                <p className='text-sm text-text/80 mt-1'>
                                                    {
                                                        review.owner_response
                                                            .response
                                                    }
                                                </p>
                                                {review.owner_response
                                                    .is_edited && (
                                                    <p className='text-xs text-text/40 mt-1'>
                                                        (edited)
                                                    </p>
                                                )}
                                            </div>
                                        ) : respondingTo === review.id ? (
                                            <div className='mt-4'>
                                                <textarea
                                                    value={responseText}
                                                    onChange={(e) =>
                                                        setResponseText(
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder='Write your response...'
                                                    className='w-full p-3 bg-background border border-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none'
                                                    rows={3}
                                                    maxLength={1000}
                                                />
                                                <div className='flex items-center justify-between mt-2'>
                                                    <span className='text-xs text-text/40'>
                                                        {responseText.length}
                                                        /1000
                                                    </span>
                                                    <div className='flex gap-2'>
                                                        <button
                                                            onClick={() => {
                                                                setRespondingTo(
                                                                    null
                                                                )
                                                                setResponseText(
                                                                    ""
                                                                )
                                                            }}
                                                            className='px-3 py-1.5 text-sm text-text/60 hover:text-text'
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                handleSubmitResponse(
                                                                    review.id
                                                                )
                                                            }
                                                            disabled={
                                                                !responseText.trim() ||
                                                                isSubmitting
                                                            }
                                                            className='inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors'
                                                        >
                                                            {isSubmitting ? (
                                                                <Loader2 className='w-4 h-4 animate-spin' />
                                                            ) : (
                                                                <Send className='w-4 h-4' />
                                                            )}
                                                            Send
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() =>
                                                    setRespondingTo(review.id)
                                                }
                                                className='mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline'
                                            >
                                                <MessageSquare className='w-4 h-4' />
                                                Respond to this review
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </motion.div>
                    )}

                    {activeTab === "menu" && tier !== "free" && (
                        <motion.div
                            key='menu'
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className='space-y-4'
                        >
                            <div className='flex items-center justify-between'>
                                <div>
                                    <p className='text-text/60'>
                                        {menuItems.length} /{" "}
                                        {tierConfig.menuLimit === Infinity
                                            ? "∞"
                                            : tierConfig.menuLimit}{" "}
                                        items
                                    </p>
                                </div>
                                <button
                                    onClick={openAddMenu}
                                    disabled={
                                        tier === "pro" && menuItems.length >= 5
                                    }
                                    className='inline-flex items-center gap-1 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors'
                                >
                                    <Plus className='w-4 h-4' />
                                    Add Item
                                </button>
                            </div>

                            {menuItems.length === 0 ? (
                                <div className='text-center py-12 text-text/60'>
                                    <UtensilsCrossed className='w-12 h-12 mx-auto mb-3 opacity-30' />
                                    <p>No menu items yet</p>
                                    <p className='text-sm'>
                                        Add your first menu item to showcase
                                        your offerings
                                    </p>
                                </div>
                            ) : (
                                <div className='grid gap-3'>
                                    {menuItems.map((item) => (
                                        <div
                                            key={item.id}
                                            className='flex items-center gap-4 p-4 bg-text/5 rounded-xl border border-text/10'
                                        >
                                            {item.image_url ? (
                                                <div className='relative w-16 h-16 rounded-lg overflow-hidden bg-text/10 shrink-0'>
                                                    <Image
                                                        src={item.image_url}
                                                        alt={item.name}
                                                        fill
                                                        className='object-cover'
                                                    />
                                                </div>
                                            ) : (
                                                <div className='w-16 h-16 rounded-lg bg-text/10 flex items-center justify-center shrink-0'>
                                                    <UtensilsCrossed className='w-6 h-6 text-text/30' />
                                                </div>
                                            )}
                                            <div className='flex-1 min-w-0'>
                                                <div className='flex items-center gap-2'>
                                                    <p className='font-medium truncate'>
                                                        {item.name}
                                                    </p>
                                                    {item.is_signature && (
                                                        <span className='px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded'>
                                                            Signature
                                                        </span>
                                                    )}
                                                    {!item.is_available && (
                                                        <span className='px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded'>
                                                            Unavailable
                                                        </span>
                                                    )}
                                                </div>
                                                <p className='text-sm text-text/60 truncate'>
                                                    {item.category}
                                                </p>
                                                <p className='text-sm font-medium text-primary'>
                                                    ₱{item.price.toFixed(2)}
                                                </p>
                                            </div>
                                            <div className='flex items-center gap-1'>
                                                <button
                                                    onClick={() =>
                                                        openEditMenu(item)
                                                    }
                                                    className='p-2 text-text/40 hover:text-text transition-colors'
                                                >
                                                    <Edit2 className='w-4 h-4' />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleDeleteMenuItem(
                                                            item.id
                                                        )
                                                    }
                                                    className='p-2 text-text/40 hover:text-red-500 transition-colors'
                                                >
                                                    <Trash2 className='w-4 h-4' />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Analytics Tab */}
                    {activeTab === "analytics" && (
                        <motion.div
                            key='analytics'
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className='space-y-6'
                        >
                            {/* Overview Stats */}
                            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                                <div className='p-4 bg-text/5 rounded-xl border border-text/10'>
                                    <p className='text-sm text-text/60'>
                                        Total Reviews
                                    </p>
                                    <p className='text-3xl font-bold mt-1'>
                                        {reviews.length}
                                    </p>
                                </div>
                                <div className='p-4 bg-text/5 rounded-xl border border-text/10'>
                                    <p className='text-sm text-text/60'>
                                        Average Rating
                                    </p>
                                    <p className='text-3xl font-bold mt-1 flex items-center gap-1'>
                                        {reviews.length > 0
                                            ? (
                                                  reviews.reduce(
                                                      (sum, r) =>
                                                          sum + r.rating,
                                                      0
                                                  ) / reviews.length
                                              ).toFixed(1)
                                            : "—"}
                                        <Star className='w-5 h-5 text-yellow-500 fill-yellow-500' />
                                    </p>
                                </div>
                                <div className='p-4 bg-text/5 rounded-xl border border-text/10'>
                                    <p className='text-sm text-text/60'>
                                        Response Rate
                                    </p>
                                    <p className='text-3xl font-bold mt-1'>
                                        {reviews.length > 0
                                            ? Math.round(
                                                  (reviews.filter(
                                                      (r) => r.owner_response
                                                  ).length /
                                                      reviews.length) *
                                                      100
                                              )
                                            : 0}
                                        %
                                    </p>
                                </div>
                                <div className='p-4 bg-text/5 rounded-xl border border-text/10'>
                                    <p className='text-sm text-text/60'>
                                        Pending Responses
                                    </p>
                                    <p className='text-3xl font-bold mt-1'>
                                        {
                                            reviews.filter(
                                                (r) => !r.owner_response
                                            ).length
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Rating Distribution */}
                            <div className='p-6 bg-text/5 rounded-xl border border-text/10'>
                                <h3 className='font-semibold mb-4'>
                                    Rating Distribution
                                </h3>
                                <div className='space-y-3'>
                                    {[5, 4, 3, 2, 1].map((rating) => {
                                        const count = reviews.filter(
                                            (r) => r.rating === rating
                                        ).length
                                        const percentage =
                                            reviews.length > 0
                                                ? (count / reviews.length) * 100
                                                : 0
                                        return (
                                            <div
                                                key={rating}
                                                className='flex items-center gap-3'
                                            >
                                                <div className='flex items-center gap-1 w-12'>
                                                    <span className='font-medium'>
                                                        {rating}
                                                    </span>
                                                    <Star className='w-4 h-4 text-yellow-500 fill-yellow-500' />
                                                </div>
                                                <div className='flex-1 h-4 bg-text/10 rounded-full overflow-hidden'>
                                                    <div
                                                        className='h-full bg-primary rounded-full transition-all duration-500'
                                                        style={{
                                                            width: `${percentage}%`,
                                                        }}
                                                    />
                                                </div>
                                                <div className='w-20 text-right'>
                                                    <span className='text-sm font-medium'>
                                                        {count}
                                                    </span>
                                                    <span className='text-sm text-text/50 ml-1'>
                                                        ({percentage.toFixed(0)}
                                                        %)
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className='p-6 bg-text/5 rounded-xl border border-text/10'>
                                <h3 className='font-semibold mb-4'>
                                    Recent Reviews
                                </h3>
                                {reviews.length === 0 ? (
                                    <p className='text-text/60 text-center py-8'>
                                        No reviews yet
                                    </p>
                                ) : (
                                    <div className='space-y-4'>
                                        {reviews.slice(0, 5).map((review) => (
                                            <div
                                                key={review.id}
                                                className='flex items-start gap-3 p-3 bg-background/50 rounded-lg'
                                            >
                                                <div className='flex-1 min-w-0'>
                                                    <div className='flex items-center gap-2'>
                                                        <span className='font-medium text-sm'>
                                                            {
                                                                review.author
                                                                    .display_name
                                                            }
                                                        </span>
                                                        <div className='flex items-center gap-0.5'>
                                                            {[...Array(5)].map(
                                                                (_, i) => (
                                                                    <Star
                                                                        key={i}
                                                                        className={`w-3 h-3 ${i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-text/20"}`}
                                                                    />
                                                                )
                                                            )}
                                                        </div>
                                                        {review.owner_response && (
                                                            <Check className='w-4 h-4 text-green-500' />
                                                        )}
                                                    </div>
                                                    <p className='text-sm text-text/70 line-clamp-2 mt-1'>
                                                        {review.comment}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Coming Soon */}
                            <div className='p-6 bg-linear-to-br from-primary/5 to-secondary/5 rounded-xl border border-primary/20'>
                                <h3 className='font-semibold mb-2'>
                                    📊 More Analytics Coming Soon
                                </h3>
                                <p className='text-sm text-text/60'>
                                    Page views, visitor trends, and conversion
                                    tracking will be available in a future
                                    update.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "settings" && (
                        <motion.div
                            key='settings'
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className='space-y-6'
                        >
                            <div className='p-6 bg-text/5 rounded-xl border border-text/10'>
                                <h3 className='font-semibold mb-4'>
                                    Edit Cafe Details
                                </h3>
                                <p className='text-text/60 mb-4'>
                                    You can edit basic details like description,
                                    contact info, and operating hours. For major
                                    changes (name, address), please contact
                                    support.
                                </p>
                                <Link
                                    href={`/owner/cafes/${cafe.id}/edit`}
                                    className='inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors'
                                >
                                    <Edit2 className='w-4 h-4' />
                                    Edit Cafe
                                </Link>
                            </div>

                            {/* Danger Zone */}
                            <div className='p-6 bg-red-50 rounded-xl border border-red-200'>
                                <h3 className='font-semibold text-red-700 mb-2'>
                                    Danger Zone
                                </h3>
                                <p className='text-red-600/80 text-sm mb-4'>
                                    Once you remove yourself as owner,
                                    you&apos;ll lose access to manage this cafe.
                                </p>
                                <button className='px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors'>
                                    Remove My Ownership
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Menu Item Modal */}
            <AnimatePresence>
                {showMenuModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
                        onClick={() => setShowMenuModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className='bg-background rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto'
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className='flex items-center justify-between mb-6'>
                                <h2 className='text-xl font-semibold'>
                                    {editingMenuItem
                                        ? "Edit Menu Item"
                                        : "Add Menu Item"}
                                </h2>
                                <button
                                    onClick={() => setShowMenuModal(false)}
                                    className='p-2 hover:bg-text/10 rounded-lg transition-colors'
                                >
                                    <X className='w-5 h-5' />
                                </button>
                            </div>

                            <div className='space-y-4'>
                                <div>
                                    <label className='block text-sm font-medium mb-1'>
                                        Name *
                                    </label>
                                    <input
                                        type='text'
                                        value={menuForm.name}
                                        onChange={(e) =>
                                            setMenuForm({
                                                ...menuForm,
                                                name: e.target.value,
                                            })
                                        }
                                        placeholder='e.g. Flat White'
                                        className='w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                                    />
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-1'>
                                        Category *
                                    </label>
                                    <select
                                        value={menuForm.category}
                                        onChange={(e) =>
                                            setMenuForm({
                                                ...menuForm,
                                                category: e.target.value,
                                            })
                                        }
                                        className='w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                                    >
                                        <option value='Coffee'>Coffee</option>
                                        <option value='Non-Coffee'>
                                            Non-Coffee
                                        </option>
                                        <option value='Espresso'>
                                            Espresso
                                        </option>
                                        <option value='Tea'>Tea</option>
                                        <option value='Pastry'>Pastry</option>
                                        <option value='Food'>Food</option>
                                        <option value='Dessert'>Dessert</option>
                                        <option value='Other'>Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-1'>
                                        Price (₱) *
                                    </label>
                                    <input
                                        type='number'
                                        min='0'
                                        step='0.01'
                                        value={menuForm.price || ""}
                                        onChange={(e) =>
                                            setMenuForm({
                                                ...menuForm,
                                                price:
                                                    parseFloat(
                                                        e.target.value
                                                    ) || 0,
                                            })
                                        }
                                        placeholder='0.00'
                                        className='w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                                    />
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-1'>
                                        Description
                                    </label>
                                    <textarea
                                        value={menuForm.description || ""}
                                        onChange={(e) =>
                                            setMenuForm({
                                                ...menuForm,
                                                description: e.target.value,
                                            })
                                        }
                                        placeholder='Optional description...'
                                        rows={2}
                                        className='w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none'
                                    />
                                </div>

                                <div className='flex items-center gap-4'>
                                    <label className='flex items-center gap-2 cursor-pointer'>
                                        <input
                                            type='checkbox'
                                            checked={
                                                menuForm.is_signature || false
                                            }
                                            onChange={(e) =>
                                                setMenuForm({
                                                    ...menuForm,
                                                    is_signature:
                                                        e.target.checked,
                                                })
                                            }
                                            className='w-4 h-4 rounded border-text/30 text-primary focus:ring-primary/50'
                                        />
                                        <span className='text-sm'>
                                            Signature Item
                                        </span>
                                    </label>
                                    <label className='flex items-center gap-2 cursor-pointer'>
                                        <input
                                            type='checkbox'
                                            checked={
                                                menuForm.is_available ?? true
                                            }
                                            onChange={(e) =>
                                                setMenuForm({
                                                    ...menuForm,
                                                    is_available:
                                                        e.target.checked,
                                                })
                                            }
                                            className='w-4 h-4 rounded border-text/30 text-primary focus:ring-primary/50'
                                        />
                                        <span className='text-sm'>
                                            Available
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className='flex gap-3 mt-6'>
                                <button
                                    onClick={() => setShowMenuModal(false)}
                                    className='flex-1 px-4 py-2 bg-text/10 rounded-lg font-medium hover:bg-text/20 transition-colors'
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveMenuItem}
                                    disabled={isSubmitting}
                                    className='flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2'
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className='w-4 h-4 animate-spin' />
                                            Saving...
                                        </>
                                    ) : editingMenuItem ? (
                                        "Save Changes"
                                    ) : (
                                        "Add Item"
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
