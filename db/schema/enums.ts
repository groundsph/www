import { pgEnum } from "drizzle-orm/pg-core"

// Badge
export const badgeCategoryEnum = pgEnum("badge_category", [
    "achievement",
    "monetary",
    "social",
])
export const badgeRarityEnum = pgEnum("badge_rarity", [
    "common",
    "rare",
    "legendary",
])

// Blog
export const blogCategoryEnum = pgEnum("blog_category", [
    "news",
    "guides",
    "events",
    "promotions",
    "community",
    "cafe_update",
])
export const blogStatusEnum = pgEnum("blog_status", [
    "pending",
    "draft",
    "published",
    "archived",
])

// Cafe
export const coffeeStyleEnum = pgEnum("coffee_style", ["classic", "artisan"])
export const membershipTierEnum = pgEnum("membership_tier", [
    "free",
    "basic",
    "premium",
])
export const priceLevelEnum = pgEnum("price_level", ["low", "medium", "high"])
export const subscriptionStatusEnum = pgEnum("subscription_status", [
    "active",
    "cancelled",
    "past_due",
    "trialing",
])

// Contribution
export const contributionActionTypeEnum = pgEnum("contribution_action_type", [
    "CREATE",
    "UPDATE",
    "VERIFY",
    "MEDIA",
    "SUGGEST",
])

// Event
export const eventStatusEnum = pgEnum("event_status", [
    "pending",
    "draft",
    "published",
    "cancelled",
])

// Featured
export const slotTypeEnum = pgEnum("slot_type", [
    "hero",
    "sidebar",
    "collection",
    "regional_spotlight",
])

// Review
export const interactionTypeEnum = pgEnum("interaction_type", ["like", "report"])
export const reviewStatusEnum = pgEnum("review_status", [
    "published",
    "hidden",
    "flagged",
])

// User
export const userRoleEnum = pgEnum("user_role", [
    "user",
    "writer",
    "moderator",
    "admin",
])
export const scoutRankEnum = pgEnum("scout_rank", [
    "novice",
    "scout",
    "explorer",
    "expert",
    "vanguard",
    "legend",
])
export const verificationStatusEnum = pgEnum("verification_status", [
    "pending",
    "approved",
    "rejected",
])

// Cafe Crawls
export const crawlStatusEnum = pgEnum("crawl_status", [
    "draft",
    "published",
    "archived",
])
