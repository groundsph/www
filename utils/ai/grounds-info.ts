import { db } from "@/db"
import { cafes, blogPosts, cafeCrawls, profiles } from "@/db/schema"
import { eq, count } from "drizzle-orm"

export interface GroundsInfo {
    platform: string
    url: string
    description: string
    features: {
        name: string
        description: string
    }[]
    howTo: {
        action: string
        steps: string[]
    }[]
    stats: {
        totalCafes: number
        totalBlogPosts: number
        totalCrawls: number
        totalUsers: number
    }
    notes: string[]
}

export async function getGroundsInfo(): Promise<GroundsInfo> {
    let stats = {
        totalCafes: 0,
        totalBlogPosts: 0,
        totalCrawls: 0,
        totalUsers: 0,
    }

    try {
        const [cafeCount, blogCount, crawlCount, userCount] = await Promise.all([
            db.select({ count: count() }).from(cafes).where(eq(cafes.isPublished, true)),
            db.select({ count: count() }).from(blogPosts).where(eq(blogPosts.status, "published")),
            db.select({ count: count() }).from(cafeCrawls).where(eq(cafeCrawls.status, "published")),
            db.select({ count: count() }).from(profiles),
        ])

        stats = {
            totalCafes: Number(cafeCount[0]?.count ?? 0),
            totalBlogPosts: Number(blogCount[0]?.count ?? 0),
            totalCrawls: Number(crawlCount[0]?.count ?? 0),
            totalUsers: Number(userCount[0]?.count ?? 0),
        }
    } catch {
        // Fall back to zeros if DB queries fail
    }

    return {
        platform: "GroundsPH",
        url: "https://grounds.ph",
        description: "GroundsPH is a community-driven coffee discovery platform for the Philippines. It helps coffee lovers find, review, and share their favorite cafes across the country.",
        features: [
            { name: "Cafe Directory", description: `Browse ${stats.totalCafes}+ cafes across the Philippines with detailed info on amenities, hours, prices, and more.` },
            { name: "Reviews & Ratings", description: "Read and write reviews for cafes. Rate your experience and help others discover great coffee." },
            { name: "Cafe Crawls", description: "Create and share curated cafe crawl routes -- plan a day of coffee hopping with friends." },
            { name: "Collections", description: "Save cafes to personal collections and share curated lists with the community." },
            { name: "Blog", description: `Read ${stats.totalBlogPosts}+ articles about Philippine coffee culture, cafe reviews, and coffee guides.` },
            { name: "Maps", description: "Find cafes near you with an interactive map showing locations and details." },
            { name: "Events", description: "Discover coffee events, meetups, and tastings happening near you." },
            { name: "Community", description: "Connect with fellow coffee enthusiasts, follow other users, and share your coffee journey." },
            { name: "Hidden Gems", description: "Discover lesser-known cafes that the community loves -- off the beaten path spots." },
            { name: "Badges & Leaderboards", description: "Earn badges for contributions and compete on monthly leaderboards." },
        ],
        howTo: [
            {
                action: "Find a cafe",
                steps: [
                    "Use the search bar or browse by city/region",
                    "Filter by amenities (wifi, sockets, pet-friendly, etc.)",
                    "Check ratings and reviews before visiting",
                ],
            },
            {
                action: "Write a review",
                steps: [
                    "Visit a cafe page and click 'Write a Review'",
                    "Rate your experience and add photos",
                    "Share your thoughts on coffee, ambiance, and service",
                ],
            },
            {
                action: "Create a crawl",
                steps: [
                    "Go to 'Crawls' and click 'Create New'",
                    "Add cafe stops and arrange the route",
                    "Add notes for each stop and publish",
                ],
            },
            {
                action: "Save favorites",
                steps: [
                    "Click the heart/save icon on any cafe",
                    "Organize saved cafes into collections",
                    "Share collections with friends",
                ],
            },
        ],
        stats,
        notes: [
            "Data is community-maintained and user-submitted",
            "Cafe information may not always be up-to-date",
            `Platform has ${stats.totalUsers} registered users`,
            "The AI assistant can help you find cafes, plan crawls, and answer questions about the platform",
        ],
    }
}
