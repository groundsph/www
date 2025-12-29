"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import {
    CafeMenuItem,
    CafeSubscription,
    MenuItemForm,
    OwnerReviewResponse,
    SUBSCRIPTION_TIERS,
    SubscriptionTier,
    canAccessFeature,
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
    Headphones,
    Loader2,
    MessageSquare,
    Pin,
    Plus,
    QrCode,
    Send,
    Settings,
    Star,
    Trash2,
    UtensilsCrossed,
    Verified,
    FileText,
    Calendar,
    CalendarIcon,
    Download,
    Copy,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import Image from "next/image"
import Link from "next/link"
import { useState, useEffect } from "react"
import {
    respondToReview,
    deleteReviewResponse,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    pinReview,
    unpinReview,
    requestFeaturedSlot,
    getFeaturedSlotRequests,
    FeaturedSlotRequest,
} from "@/app/api/actions/owner"
import { useNotification } from "@/components/NotificationProvider"
import { getCafeThumbnailUrl } from "@/utils/extras"
import BlogEditor from "@/components/blog/BlogEditor"
import EventsManagement from "@/components/events/EventsManagement"
import MenuItemModal from "@/components/cafe-editor/MenuItemModal"
import { EventWithCafe } from "@/utils/types/extra"

interface CafeManagementClientProps {
    cafe: CafeWithRatings
    subscription: CafeSubscription | null
    reviews: {
        id: string
        rating: number
        comment: string
        created_at: string | null
        is_pinned_by_owner: boolean
        pinned_at: string | null
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

type Tab =
    | "overview"
    | "reviews"
    | "menu"
    | "analytics"
    | "blog"
    | "events"
    | "settings"

export default function CafeManagementClient({
    cafe,
    subscription,
    reviews: initialReviews,
    menuItems: initialMenuItems,
}: CafeManagementClientProps) {
    const tier = subscription?.tier || "free"
    const tierConfig = SUBSCRIPTION_TIERS[tier]
    const colors = tierColors[tier]

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

    // Blog management state
    const [showBlogEditor, setShowBlogEditor] = useState(false)
    const [blogPosts, setBlogPosts] = useState<
        {
            id: string
            title: string
            slug: string
            status: string
            category: string
            created_at: string | null
        }[]
    >([])
    const [blogLoading, setBlogLoading] = useState(false)

    // Events management state
    const [events, setEvents] = useState<EventWithCafe[]>([])
    const [eventsLoading, setEventsLoading] = useState(false)

    // Analytics state
    const [analytics, setAnalytics] = useState<{
        totalViews: number
        uniqueVisitors: number
        viewsByDay: { date: string; views: number; uniqueVisitors: number }[]
        deviceBreakdown: { mobile: number; desktop: number; tablet: number }
        topReferrers: { referrer: string; count: number }[]
    } | null>(null)

    // Featured Slot Requests state
    const [featuredRequests, setFeaturedRequests] = useState<
        FeaturedSlotRequest[]
    >([])
    const [isLoadingRequests, setIsLoadingRequests] = useState(false)

    // Fetch featured requests on load
    useEffect(() => {
        const fetchRequests = async () => {
            if (tier === "premium") {
                setIsLoadingRequests(true)
                try {
                    const reqs = await getFeaturedSlotRequests(cafe.id)
                    setFeaturedRequests(reqs)
                } catch (e) {
                    console.error("Failed to fetch featured requests", e)
                } finally {
                    setIsLoadingRequests(false)
                }
            }
        }
        fetchRequests()
    }, [tier, cafe.id])
    const [analyticsLoading, setAnalyticsLoading] = useState(false)
    const [analyticsPeriod, setAnalyticsPeriod] = useState<7 | 30 | 90>(30)

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
        setShowMenuModal(true)
    }

    const openEditMenu = (item: CafeMenuItem) => {
        setEditingMenuItem(item)
        setShowMenuModal(true)
    }

    const handleSaveMenuItem = async (
        formData: MenuItemForm
    ): Promise<boolean> => {
        if (!formData.name.trim()) {
            addNotification("Please enter a name", "error")
            return false
        }
        if (formData.price <= 0) {
            addNotification("Please enter a valid price", "error")
            return false
        }

        setIsSubmitting(true)

        if (editingMenuItem) {
            // Update existing
            const result = await updateMenuItem(editingMenuItem.id, formData)
            if (result.success) {
                setMenuItems((prev) =>
                    prev.map((item) =>
                        item.id === editingMenuItem.id
                            ? { ...item, ...formData }
                            : item
                    )
                )
                addNotification("Menu item updated", "success")
                setIsSubmitting(false)
                return true
            } else {
                addNotification(result.error || "Failed to update", "error")
                setIsSubmitting(false)
                return false
            }
        } else {
            // Add new
            const result = await addMenuItem(cafe.id, formData)
            if (result.success && result.item) {
                setMenuItems((prev) => [...prev, result.item!])
                addNotification("Menu item added", "success")
                setIsSubmitting(false)
                return true
            } else {
                addNotification(result.error || "Failed to add", "error")
                setIsSubmitting(false)
                return false
            }
        }
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

    const handleToggleAvailability = async (item: CafeMenuItem) => {
        const newAvailability = !item.is_available

        // Optimistically update UI
        setMenuItems((prev) =>
            prev.map((i) =>
                i.id === item.id ? { ...i, is_available: newAvailability } : i
            )
        )

        const result = await updateMenuItem(item.id, {
            name: item.name,
            category: item.category,
            price: item.price,
            is_available: newAvailability,
        })

        if (!result.success) {
            // Revert on failure
            setMenuItems((prev) =>
                prev.map((i) =>
                    i.id === item.id
                        ? { ...i, is_available: item.is_available }
                        : i
                )
            )
            addNotification(
                result.error || "Failed to update availability",
                "error"
            )
        }
    }

    // Blog handlers
    const loadBlogPosts = async () => {
        setBlogLoading(true)
        const { getOwnerBlogPosts } = await import("@/app/api/actions/blog")
        const posts = await getOwnerBlogPosts(cafe.id)
        setBlogPosts(
            posts.map((p) => ({
                id: p.id,
                title: p.title,
                slug: p.slug,
                status: p.status,
                category: p.category,
                created_at: p.created_at,
            }))
        )
        setBlogLoading(false)
    }

    const handleBlogSuccess = async () => {
        await loadBlogPosts()
        setShowBlogEditor(false)
        addNotification("Blog post saved", "success")
    }

    const handleDeleteBlogPost = async (postId: string) => {
        if (!confirm("Delete this blog post?")) return
        const { deleteBlogPost } = await import("@/app/api/actions/blog")
        const result = await deleteBlogPost(postId)
        if (result.success) {
            setBlogPosts((prev) => prev.filter((p) => p.id !== postId))
            addNotification("Blog post deleted", "success")
        } else {
            addNotification(result.error || "Failed to delete", "error")
        }
    }

    // Load blog posts when blog tab is selected
    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab)
        if (tab === "blog" && blogPosts.length === 0) {
            loadBlogPosts()
        }
        if (tab === "events" && events.length === 0) {
            loadEvents()
        }
        if (tab === "analytics" && !analytics) {
            loadAnalytics()
        }
    }

    // Load events for this cafe
    const loadEvents = async () => {
        setEventsLoading(true)
        const { getCafeEvents } = await import("@/app/api/actions/events")
        const cafeEvents = await getCafeEvents(cafe.id)
        setEvents(cafeEvents)
        setEventsLoading(false)
    }

    // Load analytics for this cafe
    const loadAnalytics = async (days: 7 | 30 | 90 = analyticsPeriod) => {
        setAnalyticsLoading(true)
        const { getCafeAnalytics } = await import("@/app/api/actions/analytics")
        const data = await getCafeAnalytics(cafe.id, days)
        setAnalytics(data)
        setAnalyticsLoading(false)
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
            locked: !canAccessFeature(tier, "menu"),
        },
        {
            id: "analytics" as Tab,
            label: "Analytics",
            icon: BarChart3,
            locked: !canAccessFeature(tier, "analytics"),
            requiredTier: "Pro",
        },
        {
            id: "blog" as Tab,
            label: "Blog",
            icon: FileText,
            locked: !canAccessFeature(tier, "blog"),
            requiredTier: "Pro",
        },
        {
            id: "events" as Tab,
            label: "Events",
            icon: CalendarIcon,
            locked: tier !== "premium",
            requiredTier: "Premium",
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
                                <Building2 className='w-10 h-10 text-text opacity-30' />
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
                                        !isLocked && handleTabChange(tab.id)
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
                                            {tab.requiredTier}
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
                                            href={`/owner/subscriptions?cafe=${cafe.slug}`}
                                            className='inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors'
                                        >
                                            Upgrade
                                            <ChevronRight className='w-4 h-4' />
                                        </Link>
                                    )}
                                </div>
                            </div>

                            {/* QR Code to Menu (Pro/Premium only) */}
                            {canAccessFeature(tier, "qr_menu") &&
                                menuItems.length > 0 && (
                                    <div className='p-6 bg-text/5 rounded-xl border border-text/10'>
                                        <h3 className='font-semibold mb-4 flex items-center gap-2'>
                                            <QrCode className='w-5 h-5 text-primary' />
                                            QR Code Menu
                                        </h3>
                                        <div className='flex flex-col md:flex-row gap-6 items-center'>
                                            <div className='bg-white p-4 rounded-xl'>
                                                <QRCodeSVG
                                                    value={`https://grounds.ph/cafes/${cafe.slug}/menu`}
                                                    size={150}
                                                    level='H'
                                                    id='qr-code-svg'
                                                    bgColor='#f8f4e1'
                                                    imageSettings={{
                                                        src: "/icon.png",
                                                        height: 30,
                                                        width: 30,
                                                        excavate: true,
                                                    }}
                                                />
                                            </div>
                                            <div className='flex-1 text-center md:text-left'>
                                                <p className='text-text/80 mb-3'>
                                                    Customers can scan this QR
                                                    code to view your digital
                                                    menu.
                                                </p>
                                                <div className='flex flex-col sm:flex-row gap-2'>
                                                    <button
                                                        onClick={() => {
                                                            const svg =
                                                                document.getElementById(
                                                                    "qr-code-svg"
                                                                )
                                                            if (svg) {
                                                                const canvas =
                                                                    document.createElement(
                                                                        "canvas"
                                                                    )
                                                                const ctx =
                                                                    canvas.getContext(
                                                                        "2d"
                                                                    )
                                                                const qrImg =
                                                                    new window.Image()
                                                                const logoImg =
                                                                    new window.Image()
                                                                const svgData =
                                                                    new XMLSerializer().serializeToString(
                                                                        svg
                                                                    )
                                                                const svgBlob =
                                                                    new Blob(
                                                                        [
                                                                            svgData,
                                                                        ],
                                                                        {
                                                                            type: "image/svg+xml;charset=utf-8",
                                                                        }
                                                                    )
                                                                const url =
                                                                    URL.createObjectURL(
                                                                        svgBlob
                                                                    )

                                                                // Track load states
                                                                let qrLoaded = false
                                                                let logoLoaded = false

                                                                const drawAndDownload =
                                                                    () => {
                                                                        if (
                                                                            !qrLoaded ||
                                                                            !logoLoaded
                                                                        )
                                                                            return

                                                                        const padding = 40
                                                                        const qrSize = 300
                                                                        const textHeight = 50
                                                                        canvas.width =
                                                                            qrSize +
                                                                            padding *
                                                                                2
                                                                        canvas.height =
                                                                            qrSize +
                                                                            padding *
                                                                                2 +
                                                                            textHeight

                                                                        // Background color (bg-background: #f8f4e1)
                                                                        if (
                                                                            ctx
                                                                        ) {
                                                                            ctx.fillStyle =
                                                                                "#f8f4e1"
                                                                            ctx.fillRect(
                                                                                0,
                                                                                0,
                                                                                canvas.width,
                                                                                canvas.height
                                                                            )
                                                                        }

                                                                        // Draw QR code with padding
                                                                        ctx?.drawImage(
                                                                            qrImg,
                                                                            padding,
                                                                            padding,
                                                                            qrSize,
                                                                            qrSize
                                                                        )

                                                                        // Draw logo in center of QR
                                                                        const logoSize = 60
                                                                        const logoX =
                                                                            padding +
                                                                            (qrSize -
                                                                                logoSize) /
                                                                                2
                                                                        const logoY =
                                                                            padding +
                                                                            (qrSize -
                                                                                logoSize) /
                                                                                2
                                                                        ctx?.drawImage(
                                                                            logoImg,
                                                                            logoX,
                                                                            logoY,
                                                                            logoSize,
                                                                            logoSize
                                                                        )

                                                                        // Draw cafe name below
                                                                        if (
                                                                            ctx
                                                                        ) {
                                                                            ctx.fillStyle =
                                                                                "#1a1a1a"
                                                                            ctx.font =
                                                                                "bold 22px 'Playfair Display', Georgia, serif"
                                                                            ctx.textAlign =
                                                                                "center"
                                                                            ctx.fillText(
                                                                                cafe.name,
                                                                                canvas.width /
                                                                                    2,
                                                                                qrSize +
                                                                                    padding +
                                                                                    35
                                                                            )
                                                                        }

                                                                        const pngUrl =
                                                                            canvas.toDataURL(
                                                                                "image/png"
                                                                            )
                                                                        const link =
                                                                            document.createElement(
                                                                                "a"
                                                                            )
                                                                        link.download = `${cafe.slug}-menu-qr.png`
                                                                        link.href =
                                                                            pngUrl
                                                                        link.click()
                                                                        URL.revokeObjectURL(
                                                                            url
                                                                        )
                                                                    }

                                                                qrImg.onload =
                                                                    () => {
                                                                        qrLoaded = true
                                                                        drawAndDownload()
                                                                    }
                                                                logoImg.onload =
                                                                    () => {
                                                                        logoLoaded = true
                                                                        drawAndDownload()
                                                                    }

                                                                qrImg.src = url
                                                                logoImg.src =
                                                                    "/icon.png"
                                                            }
                                                        }}
                                                        className='inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors'
                                                    >
                                                        <Download className='w-4 h-4' />
                                                        Download PNG
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(
                                                                `https://grounds.ph/cafes/${cafe.slug}/menu`
                                                            )
                                                            addNotification(
                                                                "Link copied to clipboard!",
                                                                "success"
                                                            )
                                                        }}
                                                        className='inline-flex items-center justify-center gap-2 px-4 py-2 bg-text/10 rounded-lg font-medium hover:bg-text/20 transition-colors'
                                                    >
                                                        <Copy className='w-4 h-4' />
                                                        Copy Link
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

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
                                        canAccessFeature(tier, "menu") &&
                                        setActiveTab("menu")
                                    }
                                    disabled={!canAccessFeature(tier, "menu")}
                                    className={`p-4 bg-text/5 rounded-xl border border-text/10 text-left ${
                                        !canAccessFeature(tier, "menu")
                                            ? "opacity-50 cursor-not-allowed"
                                            : "hover:border-primary/30 transition-colors"
                                    }`}
                                >
                                    <UtensilsCrossed className='w-6 h-6 text-primary mb-2' />
                                    <p className='font-medium'>Manage Menu</p>
                                    <p className='text-sm text-text/60'>
                                        {`${menuItems.length} / ${tierConfig.menuLimit === Infinity ? "∞" : tierConfig.menuLimit} items`}
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

                            {/* Premium Support - Premium only */}
                            {tier === "premium" && (
                                <div className='mt-6 p-4 bg-linear-to-r from-amber-50 to-amber-100/50 rounded-xl border border-amber-200'>
                                    <div className='flex items-start gap-3'>
                                        <div className='p-2 bg-amber-500 rounded-lg'>
                                            <Headphones className='w-5 h-5 text-white' />
                                        </div>
                                        <div className='flex-1'>
                                            <h3 className='font-semibold text-amber-900'>
                                                Premium Support
                                            </h3>
                                            <p className='text-sm text-amber-800/70 mt-1'>
                                                As a Premium member, you have
                                                priority access to our support
                                                team.
                                            </p>
                                            <div className='flex flex-wrap gap-3 mt-3'>
                                                <a
                                                    href='mailto:support@grounds.ph?subject=Premium%20Support%20Request'
                                                    className='inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors'
                                                >
                                                    <Send className='w-4 h-4' />
                                                    Email Support
                                                </a>
                                                <a
                                                    href='https://discord.gg/grounds'
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                    className='inline-flex items-center gap-2 px-4 py-2 bg-white text-amber-700 border border-amber-300 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors'
                                                >
                                                    <ExternalLink className='w-4 h-4' />
                                                    Discord Channel
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Featured Slot Requests - Premium only */}
                            {tier === "premium" && (
                                <div className='mt-6 p-4 bg-linear-to-r from-purple-50 to-purple-100/50 rounded-xl border border-purple-200'>
                                    <div className='flex items-start gap-3'>
                                        <div className='p-2 bg-purple-500 rounded-lg'>
                                            <Calendar className='w-5 h-5 text-white' />
                                        </div>
                                        <div className='flex-1'>
                                            <div className='flex justify-between items-start'>
                                                <div>
                                                    <h3 className='font-semibold text-purple-900'>
                                                        Featured Slot Request
                                                    </h3>
                                                    <p className='text-sm text-purple-800/70 mt-1'>
                                                        Request to be featured
                                                        on the home page for a
                                                        specific month.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        // Calculate next month
                                                        const now = new Date()
                                                        let year =
                                                            now.getFullYear()
                                                        let month =
                                                            now.getMonth() + 1 // Next month (0-indexed current month + 1)
                                                        if (month > 11) {
                                                            month = 0
                                                            year++
                                                        }
                                                        const nextMonthDate =
                                                            new Date(
                                                                year,
                                                                month,
                                                                1
                                                            )
                                                        const formattedMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`

                                                        // Confirm dialog
                                                        if (
                                                            !confirm(
                                                                `Request featured slot for ${nextMonthDate.toLocaleString("default", { month: "long", year: "numeric" })}?`
                                                            )
                                                        )
                                                            return

                                                        const result =
                                                            await requestFeaturedSlot(
                                                                cafe.id,
                                                                formattedMonth
                                                            )
                                                        if (result.success) {
                                                            addNotification(
                                                                "Request submitted successfully!",
                                                                "success"
                                                            )
                                                            // Refresh requests
                                                            const reqs =
                                                                await getFeaturedSlotRequests(
                                                                    cafe.id
                                                                )
                                                            setFeaturedRequests(
                                                                reqs
                                                            )
                                                        } else {
                                                            addNotification(
                                                                result.error ||
                                                                    "Failed to submit request",
                                                                "error"
                                                            )
                                                        }
                                                    }}
                                                    className='px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors'
                                                >
                                                    Request Next Month
                                                </button>
                                            </div>

                                            {/* Requests List */}
                                            {featuredRequests.length > 0 && (
                                                <div className='mt-4 space-y-2'>
                                                    {featuredRequests.map(
                                                        (req) => (
                                                            <div
                                                                key={req.id}
                                                                className='flex justify-between items-center p-2 bg-white/60 rounded-lg border border-purple-100 text-sm'
                                                            >
                                                                <span className='font-medium text-purple-900'>
                                                                    {new Date(
                                                                        req.requested_month
                                                                    ).toLocaleString(
                                                                        "default",
                                                                        {
                                                                            month: "long",
                                                                            year: "numeric",
                                                                        }
                                                                    )}
                                                                </span>
                                                                <span
                                                                    className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize 
                                                                ${
                                                                    req.status ===
                                                                    "approved"
                                                                        ? "bg-green-100 text-green-700"
                                                                        : req.status ===
                                                                            "rejected"
                                                                          ? "bg-red-100 text-red-700"
                                                                          : "bg-yellow-100 text-yellow-700"
                                                                }`}
                                                                >
                                                                    {req.status}
                                                                </span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
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
                                            {/* Pin button - Premium only */}
                                            {tier === "premium" && (
                                                <button
                                                    onClick={async () => {
                                                        if (
                                                            review.is_pinned_by_owner
                                                        ) {
                                                            const result =
                                                                await unpinReview(
                                                                    review.id,
                                                                    cafe.id
                                                                )
                                                            if (
                                                                result.success
                                                            ) {
                                                                addNotification(
                                                                    "Review unpinned",
                                                                    "success"
                                                                )
                                                                window.location.reload()
                                                            } else {
                                                                addNotification(
                                                                    result.error ||
                                                                        "Failed to unpin",
                                                                    "error"
                                                                )
                                                            }
                                                        } else {
                                                            const result =
                                                                await pinReview(
                                                                    review.id,
                                                                    cafe.id
                                                                )
                                                            if (
                                                                result.success
                                                            ) {
                                                                addNotification(
                                                                    "Review pinned!",
                                                                    "success"
                                                                )
                                                                window.location.reload()
                                                            } else {
                                                                addNotification(
                                                                    result.error ||
                                                                        "Failed to pin",
                                                                    "error"
                                                                )
                                                            }
                                                        }
                                                    }}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        review.is_pinned_by_owner
                                                            ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                                                            : "bg-text/5 text-text/40 hover:bg-text/10 hover:text-text/60"
                                                    }`}
                                                    title={
                                                        review.is_pinned_by_owner
                                                            ? "Unpin review"
                                                            : "Pin review (max 3)"
                                                    }
                                                >
                                                    <Pin
                                                        className={`w-4 h-4 ${review.is_pinned_by_owner ? "fill-amber-600" : ""}`}
                                                    />
                                                </button>
                                            )}
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

                    {activeTab === "menu" && canAccessFeature(tier, "menu") && (
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
                                        menuItems.length >= tierConfig.menuLimit
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
                                <div className='space-y-6'>
                                    {/* Group by category */}
                                    {[
                                        ...new Set(
                                            menuItems.map(
                                                (item) => item.category
                                            )
                                        ),
                                    ].map((category) => (
                                        <div key={category}>
                                            <h3 className='text-sm font-semibold text-text/70 uppercase tracking-wide mb-3'>
                                                {category}
                                            </h3>

                                            {/* Add-ons: render as simple list */}
                                            {category === "Add-ons" ? (
                                                <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                                                    {menuItems
                                                        .filter(
                                                            (item) =>
                                                                item.category ===
                                                                category
                                                        )
                                                        .map((item) => (
                                                            <div
                                                                key={item.id}
                                                                className={`flex items-center justify-between py-2 px-3 rounded-lg border transition-all ${
                                                                    item.is_available
                                                                        ? "bg-text/5 border-text/10"
                                                                        : "bg-red-50 border-red-200 opacity-60"
                                                                }`}
                                                            >
                                                                <div className='flex-1 min-w-0'>
                                                                    <span className='font-medium text-sm'>
                                                                        {
                                                                            item.name
                                                                        }
                                                                    </span>
                                                                    {item.description && (
                                                                        <span className='text-xs text-text/60 ml-2 truncate'>
                                                                            {
                                                                                item.description
                                                                            }
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className='text-sm font-semibold text-primary mx-2'>
                                                                    +₱
                                                                    {item.price.toFixed(
                                                                        0
                                                                    )}
                                                                </span>
                                                                {/* Toggle + Actions */}
                                                                <div className='flex items-center gap-2'>
                                                                    <button
                                                                        onClick={() =>
                                                                            handleToggleAvailability(
                                                                                item
                                                                            )
                                                                        }
                                                                        className={`relative w-8 h-4 rounded-full transition-colors ${
                                                                            item.is_available
                                                                                ? "bg-green-500"
                                                                                : "bg-gray-300"
                                                                        }`}
                                                                        title={
                                                                            item.is_available
                                                                                ? "Mark as unavailable"
                                                                                : "Mark as available"
                                                                        }
                                                                    >
                                                                        <span
                                                                            className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                                                                                item.is_available
                                                                                    ? "translate-x-4"
                                                                                    : "translate-x-0"
                                                                            }`}
                                                                        />
                                                                    </button>
                                                                    <button
                                                                        onClick={() =>
                                                                            openEditMenu(
                                                                                item
                                                                            )
                                                                        }
                                                                        className='p-1 text-text/40 hover:text-text transition-colors'
                                                                        title='Edit'
                                                                    >
                                                                        <Edit2 className='w-3 h-3' />
                                                                    </button>
                                                                    <button
                                                                        onClick={() =>
                                                                            handleDeleteMenuItem(
                                                                                item.id
                                                                            )
                                                                        }
                                                                        className='p-1 text-text/40 hover:text-red-500 transition-colors'
                                                                        title='Delete'
                                                                    >
                                                                        <Trash2 className='w-3 h-3' />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            ) : (
                                                /* Regular grid for other categories */
                                                <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3'>
                                                    {menuItems
                                                        .filter(
                                                            (item) =>
                                                                item.category ===
                                                                category
                                                        )
                                                        .map((item) => (
                                                            <div
                                                                key={item.id}
                                                                className={`relative p-3 rounded-xl border transition-all ${
                                                                    item.is_available
                                                                        ? "bg-text/5 border-text/10"
                                                                        : "bg-red-50 border-red-200 opacity-60"
                                                                }`}
                                                            >
                                                                {/* Image */}
                                                                {item.image_url ? (
                                                                    <div className='relative w-full aspect-square rounded-lg overflow-hidden mb-2'>
                                                                        <Image
                                                                            src={
                                                                                item.image_url
                                                                            }
                                                                            alt={
                                                                                item.name
                                                                            }
                                                                            fill
                                                                            className='object-cover'
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div className='w-full aspect-square rounded-lg bg-text/10 flex items-center justify-center mb-2'>
                                                                        <UtensilsCrossed className='w-8 h-8 text-text opacity-30' />
                                                                    </div>
                                                                )}

                                                                {/* Item Info */}
                                                                <div className='space-y-1'>
                                                                    <h4 className='font-medium text-sm leading-tight'>
                                                                        {
                                                                            item.name
                                                                        }
                                                                        {item.is_signature && (
                                                                            <span className='ml-1 text-amber-500'>
                                                                                ★
                                                                            </span>
                                                                        )}
                                                                    </h4>
                                                                    <p className='text-sm font-semibold text-primary'>
                                                                        ₱
                                                                        {item.price.toFixed(
                                                                            0
                                                                        )}
                                                                    </p>
                                                                </div>

                                                                {/* Actions Row */}
                                                                <div className='flex items-center justify-between mt-3 pt-2 border-t border-text/10'>
                                                                    {/* Availability Toggle */}
                                                                    <button
                                                                        onClick={() =>
                                                                            handleToggleAvailability(
                                                                                item
                                                                            )
                                                                        }
                                                                        className={`relative w-10 h-5 rounded-full transition-colors ${
                                                                            item.is_available
                                                                                ? "bg-green-500"
                                                                                : "bg-gray-300"
                                                                        }`}
                                                                        title={
                                                                            item.is_available
                                                                                ? "Mark as unavailable"
                                                                                : "Mark as available"
                                                                        }
                                                                    >
                                                                        <span
                                                                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                                                                item.is_available
                                                                                    ? "translate-x-5"
                                                                                    : "translate-x-0"
                                                                            }`}
                                                                        />
                                                                    </button>

                                                                    {/* Edit/Delete Buttons */}
                                                                    <div className='flex flex-1 items-center gap-1 pl-2'>
                                                                        <button
                                                                            onClick={() =>
                                                                                openEditMenu(
                                                                                    item
                                                                                )
                                                                            }
                                                                            className='p-1.5 flex-1 items-center flex justify-center bg-accent/10 hover:bg-accent/20 text-text/40 hover:text-text transition-colors rounded'
                                                                            title='Edit item'
                                                                        >
                                                                            <Edit2 className='w-3.5 h-3.5' />
                                                                        </button>
                                                                        <button
                                                                            onClick={() =>
                                                                                handleDeleteMenuItem(
                                                                                    item.id
                                                                                )
                                                                            }
                                                                            className='p-1.5 flex-1 text-text/40 hover:text-red-500 transition-colors rounded bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center'
                                                                            title='Delete item'
                                                                        >
                                                                            <Trash2 className='w-3.5 h-3.5' />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
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
                            {/* Period Selector */}
                            <div className='flex items-center justify-between'>
                                <h2 className='text-lg font-semibold'>
                                    Page Analytics
                                </h2>
                                <div className='flex gap-2'>
                                    {([7, 30, 90] as const).map((days) => (
                                        <button
                                            key={days}
                                            onClick={() => {
                                                setAnalyticsPeriod(days)
                                                loadAnalytics(days)
                                            }}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                                analyticsPeriod === days
                                                    ? "bg-primary text-white"
                                                    : "bg-text/10 text-text/70 hover:bg-text/20"
                                            }`}
                                        >
                                            {days}d
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {analyticsLoading ? (
                                <div className='flex items-center justify-center py-12'>
                                    <Loader2 className='w-8 h-8 animate-spin text-primary' />
                                </div>
                            ) : analytics ? (
                                <>
                                    {/* Page View Stats */}
                                    <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                                        <div className='p-4 bg-text/5 rounded-xl border border-text/10'>
                                            <p className='text-sm text-text/60'>
                                                Page Views
                                            </p>
                                            <p className='text-3xl font-bold mt-1'>
                                                {analytics.totalViews.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className='p-4 bg-text/5 rounded-xl border border-text/10'>
                                            <p className='text-sm text-text/60'>
                                                Unique Visitors
                                            </p>
                                            <p className='text-3xl font-bold mt-1'>
                                                {analytics.uniqueVisitors.toLocaleString()}
                                            </p>
                                        </div>
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
                                                Avg Rating
                                            </p>
                                            <p className='text-3xl font-bold mt-1 flex items-center gap-1'>
                                                {reviews.length > 0
                                                    ? (
                                                          reviews.reduce(
                                                              (sum, r) =>
                                                                  sum +
                                                                  r.rating,
                                                              0
                                                          ) / reviews.length
                                                      ).toFixed(1)
                                                    : "—"}
                                                <Star className='w-5 h-5 text-yellow-500 fill-yellow-500' />
                                            </p>
                                        </div>
                                    </div>

                                    {/* Views Trend Chart */}
                                    <div className='p-6 bg-text/5 rounded-xl border border-text/10'>
                                        <h3 className='font-semibold mb-4'>
                                            Views Trend
                                        </h3>
                                        <div className='h-40 flex items-end gap-1'>
                                            {analytics.viewsByDay
                                                .slice(
                                                    -Math.min(
                                                        analyticsPeriod,
                                                        30
                                                    )
                                                )
                                                .map((day) => {
                                                    const maxViews = Math.max(
                                                        ...analytics.viewsByDay.map(
                                                            (d) => d.views
                                                        ),
                                                        1
                                                    )
                                                    const height =
                                                        (day.views / maxViews) *
                                                        100
                                                    return (
                                                        <div
                                                            key={day.date}
                                                            className='flex-1 relative group'
                                                            title={`${day.date}: ${day.views} views`}
                                                        >
                                                            <div
                                                                className='bg-primary/70 hover:bg-primary rounded-t transition-all'
                                                                style={{
                                                                    height: `${Math.max(height, 2)}%`,
                                                                }}
                                                            />
                                                            <div className='absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-text text-background text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none'>
                                                                {new Date(
                                                                    day.date
                                                                ).toLocaleDateString(
                                                                    "en-US",
                                                                    {
                                                                        month: "short",
                                                                        day: "numeric",
                                                                    }
                                                                )}
                                                                : {day.views}{" "}
                                                                views
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                        </div>
                                        <div className='flex justify-between text-xs text-text/40 mt-2'>
                                            <span>
                                                {new Date(
                                                    analytics.viewsByDay[
                                                        Math.max(
                                                            0,
                                                            analytics.viewsByDay
                                                                .length -
                                                                analyticsPeriod
                                                        )
                                                    ]?.date || ""
                                                ).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </span>
                                            <span>Today</span>
                                        </div>
                                    </div>

                                    {/* Device & Referrer Grid */}
                                    <div className='grid md:grid-cols-2 gap-6'>
                                        {/* Device Breakdown */}
                                        <div className='p-6 bg-text/5 rounded-xl border border-text/10'>
                                            <h3 className='font-semibold mb-4'>
                                                Device Breakdown
                                            </h3>
                                            <div className='space-y-3'>
                                                {Object.entries(
                                                    analytics.deviceBreakdown
                                                ).map(([device, count]) => {
                                                    const total =
                                                        Object.values(
                                                            analytics.deviceBreakdown
                                                        ).reduce(
                                                            (a, b) => a + b,
                                                            0
                                                        ) || 1
                                                    const percentage =
                                                        (count / total) * 100
                                                    return (
                                                        <div
                                                            key={device}
                                                            className='flex items-center gap-3'
                                                        >
                                                            <span className='w-16 text-sm capitalize'>
                                                                {device}
                                                            </span>
                                                            <div className='flex-1 h-4 bg-text/10 rounded-full overflow-hidden'>
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${
                                                                        device ===
                                                                        "mobile"
                                                                            ? "bg-blue-500"
                                                                            : device ===
                                                                                "desktop"
                                                                              ? "bg-green-500"
                                                                              : "bg-amber-500"
                                                                    }`}
                                                                    style={{
                                                                        width: `${percentage}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className='w-16 text-right text-sm text-text/60'>
                                                                {count} (
                                                                {percentage.toFixed(
                                                                    0
                                                                )}
                                                                %)
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Top Referrers */}
                                        <div className='p-6 bg-text/5 rounded-xl border border-text/10'>
                                            <h3 className='font-semibold mb-4'>
                                                Top Referrers
                                            </h3>
                                            {analytics.topReferrers.length ===
                                            0 ? (
                                                <p className='text-text/50 text-sm'>
                                                    No referrer data yet
                                                </p>
                                            ) : (
                                                <div className='space-y-2'>
                                                    {analytics.topReferrers.map(
                                                        (ref) => (
                                                            <div
                                                                key={
                                                                    ref.referrer
                                                                }
                                                                className='flex items-center justify-between p-2 bg-background/50 rounded-lg'
                                                            >
                                                                <span className='text-sm truncate flex-1'>
                                                                    {
                                                                        ref.referrer
                                                                    }
                                                                </span>
                                                                <span className='text-sm font-medium text-primary ml-2'>
                                                                    {ref.count}
                                                                </span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}
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
                                                        ? (count /
                                                              reviews.length) *
                                                          100
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
                                                                (
                                                                {percentage.toFixed(
                                                                    0
                                                                )}
                                                                %)
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className='text-center py-12 text-text/60'>
                                    <BarChart3 className='w-12 h-12 mx-auto mb-3 opacity-30' />
                                    <p>Loading analytics...</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === "blog" && (
                        <motion.div
                            key='blog'
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className='space-y-6'
                        >
                            <div className='flex items-center justify-between'>
                                <h3 className='font-semibold flex items-center gap-2'>
                                    <FileText className='w-5 h-5' />
                                    Your Blog Posts
                                </h3>
                                <button
                                    onClick={() => setShowBlogEditor(true)}
                                    className='flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors'
                                >
                                    <Plus className='w-4 h-4' />
                                    New Post
                                </button>
                            </div>

                            {blogLoading ? (
                                <div className='flex items-center justify-center py-12'>
                                    <Loader2 className='w-8 h-8 animate-spin text-primary' />
                                </div>
                            ) : blogPosts.length === 0 ? (
                                <div className='text-center py-12 text-text/60'>
                                    <FileText className='w-12 h-12 mx-auto mb-3 text-text opacity-30' />
                                    <p className='font-medium'>
                                        No blog posts yet
                                    </p>
                                    <p className='text-sm'>
                                        Share your cafe&apos;s story with the
                                        community
                                    </p>
                                </div>
                            ) : (
                                <div className='space-y-3'>
                                    {blogPosts.map((post) => (
                                        <div
                                            key={post.id}
                                            className='flex items-center justify-between p-4 bg-text/5 border border-text/10 rounded-xl'
                                        >
                                            <div>
                                                <div className='flex items-center gap-2'>
                                                    <h4 className='font-medium'>
                                                        {post.title}
                                                    </h4>
                                                    <span
                                                        className={`px-2 py-0.5 text-xs rounded-full ${
                                                            post.status ===
                                                            "published"
                                                                ? "bg-green-500/20 text-green-600"
                                                                : "bg-yellow-500/20 text-yellow-600"
                                                        }`}
                                                    >
                                                        {post.status}
                                                    </span>
                                                </div>
                                                <p className='text-sm text-text/60 mt-1'>
                                                    {post.category.replace(
                                                        "_",
                                                        " "
                                                    )}{" "}
                                                    •{" "}
                                                    {post.created_at &&
                                                        new Date(
                                                            post.created_at
                                                        ).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className='flex items-center gap-2'>
                                                <Link
                                                    href={`/blog/${post.slug}`}
                                                    target='_blank'
                                                    className='p-2 bg-text/5 rounded-lg hover:bg-text/10 transition'
                                                >
                                                    <ExternalLink className='w-4 h-4' />
                                                </Link>
                                                <button
                                                    onClick={() =>
                                                        handleDeleteBlogPost(
                                                            post.id
                                                        )
                                                    }
                                                    className='p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition'
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

                    {activeTab === "events" &&
                        canAccessFeature(tier, "events") && (
                            <motion.div
                                key='events'
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className='space-y-6'
                            >
                                {eventsLoading ? (
                                    <div className='flex items-center justify-center py-12'>
                                        <Loader2 className='w-8 h-8 animate-spin text-primary' />
                                    </div>
                                ) : (
                                    <EventsManagement
                                        initialEvents={events}
                                        cafeId={cafe.id}
                                        cafeName={cafe.name}
                                    />
                                )}
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
                                    href={`/owner/cafes/${cafe.slug}/edit`}
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
            <MenuItemModal
                open={showMenuModal}
                onClose={() => setShowMenuModal(false)}
                onSave={handleSaveMenuItem}
                editingItem={editingMenuItem}
                saving={isSubmitting}
                cafeId={cafe.id}
            />

            {/* Blog Editor Modal */}
            {showBlogEditor && (
                <div className='fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6'>
                    {/* Backdrop */}
                    <div
                        className='absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'
                        onClick={() => setShowBlogEditor(false)}
                    />

                    {/* Modal Container */}
                    <div className='relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-text/10 animate-in zoom-in-95 fade-in duration-200'>
                        {/* Decorative gradient accent */}
                        <div className='absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-primary via-secondary to-primary' />

                        {/* Scrollable content */}
                        <div className='max-h-[90vh] overflow-y-auto'>
                            <BlogEditor
                                cafeId={cafe.id}
                                cafeName={cafe.name}
                                onSuccess={handleBlogSuccess}
                                onCancel={() => setShowBlogEditor(false)}
                                allowedCategories={[
                                    "cafe_update",
                                    "promotions",
                                    "events",
                                ]}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
