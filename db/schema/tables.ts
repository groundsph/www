import {
    pgTable,
    uuid,
    text,
    timestamp,
    boolean,
    real,
    integer,
    jsonb,
    uniqueIndex,
    customType,
} from "drizzle-orm/pg-core"

import * as enums from "./enums"

import { chatRateLimits } from "./chat-rate-limit"
import { featureFlags } from "./feature-flags"

export { chatRateLimits, featureFlags }

// Custom tsvector type for full-text search columns
const tsvector = customType<{ data: string }>({
    dataType() {
        return "tsvector"
    },
})

// ============================================================================
// USER RELATED TABLES
// ============================================================================

export const profiles = pgTable("profiles", {
    id: uuid("id").primaryKey(),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    role: enums.userRoleEnum("role").default("user"),
    isSupporter: boolean("is_supporter").default(false),
    supportSince: timestamp("support_since", { withTimezone: true }),
    supporterExpiresAt: timestamp("supporter_expires_at", { withTimezone: true }),
    totalContribution: real("total_contribution").default(0),
    profileCompleted: boolean("profile_completed").default(false),
    passport: jsonb("passport"),
    stats: jsonb("stats"),
    moderatorRegions: text("moderator_regions").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const avatarDeletionQueue = pgTable("avatar_deletion_queue", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    avatarUrl: text("avatar_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================================
// BADGE TABLES
// ============================================================================

export const badgeDefinitions = pgTable("badge_definitions", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    imageUrl: text("image_url").notNull(),
    category: enums.badgeCategoryEnum("category").notNull(),
    rarity: enums.badgeRarityEnum("rarity").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const userBadges = pgTable("user_badges", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    badgeId: uuid("badge_id")
        .notNull()
        .references(() => badgeDefinitions.id, { onDelete: "cascade" }),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).defaultNow(),
    evidenceUrl: text("evidence_url"),
}, (t) => ({
    userIdBadgeIdIdx: uniqueIndex("user_badges_user_id_badge_id_unique").on(t.userId, t.badgeId),
}))

// ============================================================================
// CAFE TABLES
// ============================================================================

export const cafes = pgTable(
    "cafes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        name: text("name").notNull(),
        slug: text("slug").notNull().unique(),
        description: text("description"),
        thumbnail: text("thumbnail").notNull(),
        gallery: text("gallery").array(),
        addressDisplay: text("address_display").notNull(),
        area: text("area"),
        cityMunicipality: text("city_municipality").notNull(),
        province: text("province").notNull(),
        region: text("region").notNull(),
        lat: real("lat"),
        lng: real("lng"),
        priceLevel: enums.priceLevelEnum("price_level").notNull(),
        coffeeStyle: enums.coffeeStyleEnum("coffee_style"),
        membershipTier: enums.membershipTierEnum("membership_tier").default("free"),
        roaster: text("roaster"),
        brewMethods: text("brew_methods").array(),
        specialty: text("specialty").array(),
        milkOptions: text("milk_options").array(),
        tags: text("tags").array(),
        operatingHours: jsonb("operating_hours"),
        socials: jsonb("socials"),
        phone: text("phone"),
        email: text("email"),
        websiteUrl: text("website_url"),
        paymentMethods: text("payment_methods"),
        hasWifi: boolean("has_wifi"),
        hasSmoking: boolean("has_smoking"),
        hasSockets: boolean("has_sockets"),
        hasAircon: boolean("has_aircon"),
        hasParking: boolean("has_parking"),
        hasOutdoorSeating: boolean("has_outdoor_seating"),
        hasIndoorSeating: boolean("has_indoor_seating"),
        hasRestroom: boolean("has_restroom"),
        hasBidet: boolean("has_bidet"),
        hasNonDairy: boolean("has_non_dairy"),
        hasDecaf: boolean("has_decaf"),
        isPetFriendly: boolean("is_pet_friendly"),
        isWorkFriendly: boolean("is_work_friendly"),
        servesFood: boolean("serves_food"),
        isActive: boolean("is_active").default(true),
        isPublished: boolean("is_published").default(true),
        isVerified: boolean("is_verified").default(false),
        isClaimed: boolean("is_claimed").default(false),
        isHiddenGem: boolean("is_hidden_gem").default(false),
        hiddenGemSince: timestamp("hidden_gem_since", { withTimezone: true }),
        hiddenGemLastEvaluatedPeriod: text("hidden_gem_last_evaluated_period"), // e.g., "2026-01"
        hiddenGemGraduatedAt: timestamp("hidden_gem_graduated_at", { withTimezone: true }),
        isChain: boolean("is_chain").default(false),
        findingHint: text("finding_hint"),
        badgeStampUrl: text("badge_stamp_url"),
        ownerIds: uuid("owner_ids").array(),
        contributorId: uuid("contributor_id").references(() => profiles.id, { onDelete: "set null" }),
        featuredUntil: timestamp("featured_until", { withTimezone: true }),
        searchVector: tsvector("search_vector"),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    },
    (table) => ({
        slugIdx: uniqueIndex("cafes_slug_idx").on(table.slug),
    })
)

export const cafeRatingStats = pgTable("cafe_rating_stats", {
    cafeId: uuid("cafe_id")
        .primaryKey()
        .references(() => cafes.id, { onDelete: "cascade" }),
    averageRating: real("average_rating"),
    totalReviews: integer("total_reviews").default(0),
    ratingDistribution: jsonb("rating_distribution"),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow(),
})

export const cafeMenuItems = pgTable("cafe_menu_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    price: real("price").notNull(),
    imageUrl: text("image_url"),
    isAvailable: boolean("is_available").default(true),
    isSignature: boolean("is_signature").default(false),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const cafeStories = pgTable("cafe_stories", {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const cafeSubscriptions = pgTable("cafe_subscriptions", {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
        .notNull()
        .unique()
        .references(() => cafes.id, { onDelete: "cascade" }),
    tier: enums.membershipTierEnum("tier").default("free"),
    status: enums.subscriptionStatusEnum("status").default("active"),
    helixSubscriptionId: text("helix_subscription_id"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    isManualPayment: boolean("is_manual_payment").default(false),
    paymentVerified: boolean("payment_verified").default(false),
    proofOfPaymentUrl: text("proof_of_payment_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const cafePageViews = pgTable("cafe_page_views", {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id"),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow(),
    referrer: text("referrer"),
    deviceType: text("device_type"),
    country: text("country"),
})

// User visits to cafes (check-in system)
// Tracks each visit with timestamp, allows multiple visits per cafe (one per day max)
// Companions: array of user IDs who joined this check-in (group check-ins)
export const cafeVisits = pgTable("cafe_visits", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    visitedAt: timestamp("visited_at", { withTimezone: true }).defaultNow().notNull(),
    companions: uuid("companions").array(), // Array of user IDs who joined this check-in
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const cafeClaims = pgTable("cafe_claims", {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    proofText: text("proof_text").notNull(),
    proofDocumentUrl: text("proof_document_url"),
    status: text("status").default("pending"),
    adminNotes: text("admin_notes"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const cafeEditSuggestions = pgTable("cafe_edit_suggestions", {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    suggestedChanges: jsonb("suggested_changes").notNull(),
    suggestedImages: jsonb("suggested_images"),
    status: text("status").default("pending"),
    adminNotes: text("admin_notes"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

// ============================================================================
// REVIEW TABLES
// ============================================================================

export const reviews = pgTable("reviews", {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    images: text("images").array(),
    status: enums.reviewStatusEnum("status").default("published"),
    isEdited: boolean("is_edited").default(false),
    isVerifiedVisit: boolean("is_verified_visit").default(false),
    isPinnedByOwner: boolean("is_pinned_by_owner").default(false),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    likesCount: integer("likes_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const reviewInteractions = pgTable("review_interactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
        .notNull()
        .references(() => reviews.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    interactionType: enums.interactionTypeEnum("interaction_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const ownerReviewResponses = pgTable("owner_review_responses", {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
        .notNull()
        .unique()
        .references(() => reviews.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    response: text("response").notNull(),
    isEdited: boolean("is_edited").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

// ============================================================================
// BLOG TABLES
// ============================================================================

export const blogPosts = pgTable(
    "blog_posts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        authorId: uuid("author_id")
            .notNull()
            .references(() => profiles.id),
        cafeId: uuid("cafe_id").references(() => cafes.id, { onDelete: "set null" }),
        title: text("title").notNull(),
        slug: text("slug").notNull().unique(),
        content: text("content").notNull(),
        excerpt: text("excerpt"),
        coverImage: text("cover_image"),
        category: enums.blogCategoryEnum("category").default("news"),
        status: enums.blogStatusEnum("status").default("draft"),
        llmReview: jsonb("llm_review"),
        tags: text("tags").array(),
        images: text("images").array(),
        taggedCafeIds: uuid("tagged_cafe_ids").array(),
        crawlId: uuid("crawl_id").references(() => cafeCrawls.id, { onDelete: "set null" }),
        featured: boolean("featured").default(false),
        viewsCount: integer("views_count").default(0),
        searchVector: tsvector("search_vector"),
        publishedAt: timestamp("published_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    },
    (table) => ({
        slugIdx: uniqueIndex("blog_posts_slug_idx").on(table.slug),
    })
)

export const blogReports = pgTable("blog_reports", {
    id: uuid("id").primaryKey().defaultRandom(),
    blogPostId: uuid("blog_post_id")
        .notNull()
        .references(() => blogPosts.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").default("pending"),
    adminNotes: text("admin_notes"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================================
// EVENT TABLE
// ============================================================================

export const events = pgTable("events", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }),
    locationName: text("location_name"),
    address: text("address"),
    city: text("city"),
    province: text("province"),
    region: text("region"),
    isNational: boolean("is_national").default(false),
    ticketLink: text("ticket_link"),
    status: enums.eventStatusEnum("status").default("draft"),
    cafeId: uuid("cafe_id").references(() => cafes.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

// ============================================================================
// FEATURED TABLES
// ============================================================================

export const featuredSchedules = pgTable("featured_schedules", {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    slotType: enums.slotTypeEnum("slot_type").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    priority: integer("priority").default(0),
    regionContext: text("region_context"),
    customTitle: text("custom_title"),
    customDescription: text("custom_description"),
    customImage: text("custom_image"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const featuredSlotRequests = pgTable("featured_slot_requests", {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id").references(() => cafes.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").references(() => profiles.id),
    requestedMonth: text("requested_month").notNull(),
    status: text("status").default("pending"),
    adminNotes: text("admin_notes"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================================
// CONTRIBUTION TABLES
// ============================================================================

export const contributionLogs = pgTable("contribution_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    actionType: enums.contributionActionTypeEnum("action_type").notNull(),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================================
// VERIFICATION TABLES
// ============================================================================

export const ownerVerificationRequests = pgTable("owner_verification_requests", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    verificationType: text("verification_type").notNull(),
    proofUrls: text("proof_urls").array(),
    notes: text("notes"),
    status: enums.verificationStatusEnum("status").default("pending"),
    adminNotes: text("admin_notes"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================================
// SUPPORTER TABLES
// ============================================================================

export const supporterSubscriptions = pgTable("supporter_subscriptions", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    kofiTransactionId: text("kofi_transaction_id").notNull().unique(),
    email: text("email").notNull(),
    fromName: text("from_name").notNull(),
    amount: real("amount").notNull(),
    currency: text("currency").default("USD"),
    message: text("message"),
    isSubscription: boolean("is_subscription").default(false),
    isFirstSubscription: boolean("is_first_subscription").default(false),
    tierName: text("tier_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================================
// COLLECTION TABLES
// ============================================================================

export const collections = pgTable(
    "collections",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => profiles.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        slug: text("slug").notNull().unique(),
        description: text("description"),
        coverImage: text("cover_image"),
        items: jsonb("items").$type<{ cafeId: string; note?: string }[]>().default([]),
        itemCount: integer("item_count").default(0),
        isPublic: boolean("is_public").default(true),
        viewsCount: integer("views_count").default(0),
        likesCount: integer("likes_count").default(0),
        savesCount: integer("saves_count").default(0),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    },
    (table) => ({
        slugIdx: uniqueIndex("collections_slug_idx").on(table.slug),
    })
)

export const collectionLikes = pgTable("collection_likes", {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
        .notNull()
        .references(() => collections.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const collectionSaves = pgTable(
    "collection_saves",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        collectionId: uuid("collection_id")
            .notNull()
            .references(() => collections.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => profiles.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    },
    (t) => ({
        uniqueSaveIdx: uniqueIndex("collection_saves_user_collection_unique").on(t.userId, t.collectionId),
    })
)

// ============================================================================
// REPORTING TABLES
// ============================================================================

export const cafeReports = pgTable("cafe_reports", {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(), // "permanently_closed", "does_not_exist", "other"
    details: text("details"),
    status: text("status").default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================================
// CAFE CRAWL TABLES
// ============================================================================

export const cafeCrawls = pgTable(
    "cafe_crawls",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => profiles.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        slug: text("slug").notNull().unique(),
        description: text("description"),
        coverImage: text("cover_image"),
        status: enums.crawlStatusEnum("status").default("draft"),
        isPublic: boolean("is_public").default(true),
        itemCount: integer("item_count").default(0),
        viewsCount: integer("views_count").default(0),
        savesCount: integer("saves_count").default(0),
        likesCount: integer("likes_count").default(0),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    },
    (table) => ({
        slugIdx: uniqueIndex("cafe_crawls_slug_idx").on(table.slug),
    })
)

export const cafeCrawlItems = pgTable("cafe_crawl_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlId: uuid("crawl_id")
        .notNull()
        .references(() => cafeCrawls.id, { onDelete: "cascade" }),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const cafeCrawlSaves = pgTable(
    "cafe_crawl_saves",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        crawlId: uuid("crawl_id")
            .notNull()
            .references(() => cafeCrawls.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => profiles.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    },
    (t) => ({
        uniqueSaveIdx: uniqueIndex("crawl_saves_user_crawl_unique").on(t.userId, t.crawlId),
    })
)

export const cafeCrawlLikes = pgTable(
    "cafe_crawl_likes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        crawlId: uuid("crawl_id")
            .notNull()
            .references(() => cafeCrawls.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => profiles.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    },
    (t) => ({
        uniqueLikeIdx: uniqueIndex("crawl_likes_user_crawl_unique").on(t.userId, t.crawlId),
    })
)

export const cafeCrawlReports = pgTable("cafe_crawl_reports", {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlId: uuid("crawl_id")
        .notNull()
        .references(() => cafeCrawls.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").default("pending"),
    adminNotes: text("admin_notes"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================================
// SOCIAL TABLES
// ============================================================================

// User follows for social connections
export const userFollows = pgTable("user_follows", {
    id: uuid("id").primaryKey().defaultRandom(),
    followerId: uuid("follower_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
    // Prevent duplicate follows
    uniqueFollowIdx: uniqueIndex("user_follows_follower_following_unique").on(t.followerId, t.followingId),
}))

// ============================================================================
// SITE SETTINGS TABLE
// ============================================================================

export const siteSettings = pgTable("site_settings", {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
