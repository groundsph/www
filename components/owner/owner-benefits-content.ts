import {
    Wallet,
    ReceiptText,
    Layers,
    CreditCard,
    Store,
    PenLine,
    Images,
    BookOpen,
    Gem,
    Stamp,
    Compass,
    LayoutPanelTop,
    UtensilsCrossed,
    ScanLine,
    CalendarDays,
    QrCode,
    Ticket,
    Percent,
    TicketCheck,
    MousePointerClick,
    ClipboardCheck,
    ShieldCheck,
    MessageSquare,
    Reply,
    PencilLine,
    Pin,
    BellRing,
    LineChart,
    Eye,
    Globe,
    Star,
    Boxes,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface CtaLink {
    label: string
    href: string
}

export interface FreePillar {
    title: string
    /** Short emphasised line carrying the actual promise. */
    highlight: string
    description: string
    icon: LucideIcon
}

export interface BenefitItem {
    title: string
    /** Short emphasised line carrying the concrete fact. */
    highlight: string
    description: string
    icon: LucideIcon
}

export interface BenefitGroup {
    id: string
    title: string
    intro: string
    icon: LucideIcon
    accent: string
    items: BenefitItem[]
}

export const HERO = {
    eyebrow: "For Cafe Owners",
    heading: "Your cafe, finally yours online",
    lede: "Grounds is where people across the Philippines look for their next cafe. Claim your listing and you control what they find — the photos, the menu, the story, and your reply to every review.",
    reassurance:
        "Free to claim. Free to manage. No subscription, no commission, no card.",
} as const

export const PRIMARY_CTA: CtaLink = {
    label: "Claim your cafe",
    href: "/cafes",
}

export const SECONDARY_CTA: CtaLink = {
    label: "Add a cafe we're missing",
    href: "/submit",
}

export const CONTACT_CTA: CtaLink = {
    label: "Contact us",
    href: "/contact",
}

export const FREE_PILLARS_HEADING = "Free, and it stays free"

export const FREE_PILLARS: FreePillar[] = [
    {
        title: "No subscription",
        highlight: "Every owner tool, included",
        description:
            "There is no paid plan, no trial period, and no upgrade button. Every owner tool is included.",
        icon: Wallet,
    },
    {
        title: "No commission",
        highlight: "You keep the whole sale",
        description:
            "Grounds takes nothing from what you sell, including the discounts and vouchers you run here.",
        icon: ReceiptText,
    },
    {
        title: "No tiers",
        highlight: "Identical tools on day one",
        description:
            "Nothing is locked behind a level. A cafe that opened last week gets exactly the same tools as an established one.",
        icon: Layers,
    },
    {
        title: "No card",
        highlight: "No payment details, ever",
        description:
            "You will never be asked for payment details to claim a cafe, or to keep managing it.",
        icon: CreditCard,
    },
]

export const FREE_PILLARS_NOTE =
    "Running Grounds costs money, so there is an optional way to chip in. It is unrelated to owning a cafe and changes nothing about what you can access."

export const BENEFIT_GROUPS: BenefitGroup[] = [
    {
        id: "listing",
        title: "Own your listing",
        intro:
            "The page people land on is yours to shape, and your edits publish immediately.",
        icon: Store,
        accent: "bg-primary/10 text-primary",
        items: [
            {
                title: "Edit anything, and it goes live",
                highlight: "No approval queue",
                description:
                    "Name, description, address and map pin, hours, amenities, payment methods, price level, socials, and more. Owner edits are not queued for approval.",
                icon: PenLine,
            },
            {
                title: "Up to 12 photos, plus a cover",
                highlight: "Reorder, swap and remove as you go",
                description:
                    "Drag to reorder, swap the cover, or remove an image. Changes save on their own while you work.",
                icon: Images,
            },
            {
                title: "Tell your cafe's story",
                highlight: "A long-form section of your own",
                description:
                    "A longer narrative on your page, for the part a description cannot hold — the roaster, the room, the reason you opened.",
                icon: BookOpen,
            },
            {
                title: "Hidden Gem mode",
                highlight: "Map pin stays approximate",
                description:
                    "Mark your cafe as a hidden gem with a short finding hint. Its exact location stays approximate, and it graduates out of the mode once enough people have visited.",
                icon: Gem,
            },
            {
                title: "A collectible stamp of your own",
                highlight: "Your stamp on every check-in",
                description:
                    "Upload your own stamp image. It becomes the stamp customers collect when they check in at your cafe, and it is printed into the check-in poster you download.",
                icon: Stamp,
            },
        ],
    },
    {
        id: "discovery",
        title: "Get found",
        intro:
            "Grounds is a place people browse, search and map. Make sure your listing is the one they pick.",
        icon: Compass,
        accent: "bg-accent/10 text-accent",
        items: [
            {
                title: "A full page, not a directory entry",
                highlight: "Photos, menu, map and reviews in one",
                description:
                    "Photos, amenities, hours, a map, the menu, reviews and your story on one page built to be shared.",
                icon: LayoutPanelTop,
            },
            {
                title: "A menu page of its own",
                highlight: "A page a QR code can open",
                description:
                    "Every item with prices, photos, dietary tags, sizes and in-stock status, on a page a QR code can point straight to.",
                icon: UtensilsCrossed,
            },
            {
                title: "Read your menu in from a photo",
                highlight: "Snap the printed menu, skip duplicates",
                description:
                    "Photograph the printed menu and the items are read in for you, skipping the ones you already have.",
                icon: ScanLine,
            },
            {
                title: "Events and posts",
                highlight: "Events go live, posts are reviewed",
                description:
                    "Publish events for your cafe, and write blog posts about it. Posts are read by our team before they appear publicly.",
                icon: CalendarDays,
            },
            {
                title: "QR codes you can print",
                highlight: "Download as images, ready for the counter",
                description:
                    "Download a branded check-in code and a menu code as images, ready for the counter or the window.",
                icon: QrCode,
            },
        ],
    },
    {
        id: "customers",
        title: "Bring customers in",
        intro:
            "Run promotions on your own terms — no fees, no middleman, nothing new for your staff to learn.",
        icon: Ticket,
        accent: "bg-primary/15 text-primary",
        items: [
            {
                title: "Campaigns you design",
                highlight: "Flat amount, percent, or free item",
                description:
                    "Percentage off, a fixed amount, or a free item. Set a total cap, a per-customer limit, a minimum spend and a date window.",
                icon: Percent,
            },
            {
                title: "Voucher codes and QR handouts",
                highlight: "1,000 codes per batch",
                description:
                    "Generate up to 1,000 codes at once and download them as a CSV, or share a QR that hands a voucher to whoever scans it.",
                icon: TicketCheck,
            },
            {
                title: "Claimable straight from your page",
                highlight: "No need to ask you first",
                description:
                    "Public campaigns show on your cafe page, so someone browsing can pick one up without asking you first.",
                icon: MousePointerClick,
            },
            {
                title: "Redeem in seconds",
                highlight: "Type, see, confirm",
                description:
                    "Type the code, see the voucher, confirm. Every redemption is logged and unused codes can be cancelled.",
                icon: ClipboardCheck,
            },
            {
                title: "You keep the whole sale",
                highlight: "Grounds takes nothing",
                description:
                    "Grounds processes no payments for your vouchers and takes no cut. The transaction happens in your shop, between you and your customer.",
                icon: ShieldCheck,
            },
        ],
    },
    {
        id: "reviews",
        title: "Hear your customers",
        intro:
            "Reviews are the loudest thing on your page. Answer them where everyone can see.",
        icon: MessageSquare,
        accent: "bg-secondary/15 text-primary",
        items: [
            {
                title: "Reply publicly",
                highlight: "Your reply, with an Owner badge",
                description:
                    "Your response appears under the review with an Owner badge, so anyone reading can see you answered.",
                icon: Reply,
            },
            {
                title: "Edit or remove your reply",
                highlight: "Change or delete it any time",
                description:
                    "Made a typo or changed your mind? Update or delete your response at any time.",
                icon: PencilLine,
            },
            {
                title: "Pin your best three",
                highlight: "Three reviews at the top",
                description:
                    "Pin up to three reviews to the top of your page so first-time visitors see the strongest ones first.",
                icon: Pin,
            },
            {
                title: "Never lose track",
                highlight: "A running count of unanswered reviews",
                description:
                    "Your dashboard shows how many reviews are still waiting for a reply.",
                icon: BellRing,
            },
        ],
    },
    {
        id: "insight",
        title: "Know what is working",
        intro:
            "Numbers about your own cafe, and the back-of-house work that keeps it running.",
        icon: LineChart,
        accent: "bg-accent/15 text-accent",
        items: [
            {
                title: "Views and unique visitors",
                highlight: "Rolling 7, 30 and 90 days",
                description:
                    "How many people opened your page and how many were distinct visitors, across the last 7, 30 or 90 days.",
                icon: Eye,
            },
            {
                title: "Where they came from",
                highlight: "Devices and referring sites",
                description:
                    "A per-day trend, the split between phones, tablets and desktops, and the sites sending you the most traffic.",
                icon: Globe,
            },
            {
                title: "How you are rated",
                highlight: "Your full star breakdown",
                description:
                    "Your average next to the full star breakdown, so you can see whether you are winning or losing on the margins.",
                icon: Star,
            },
            {
                title: "Stock, without a spreadsheet",
                highlight: "Low-stock warnings and CSV export",
                description:
                    "Track items with low-stock warnings and a running valuation, log restocks, and export the list as a CSV. This part stays private to you.",
                icon: Boxes,
            },
        ],
    },
]

export interface ClaimStep {
    title: string
    /** Short emphasised line carrying the one fact that matters here. */
    highlight: string
    description: string
}

export interface FaqItem {
    question: string
    answer: string
}

export const CLAIM_STEPS_HEADING = "How claiming works"

export const CLAIM_STEPS: ClaimStep[] = [
    {
        title: "Find your cafe",
        highlight: "Search by name or area",
        description:
            "Search Grounds. If your cafe is not listed yet, add it first — new cafes are reviewed by our team before they go live, and it is the same free account.",
    },
    {
        title: "Open its page and claim it",
        highlight: "One tap with Google or Discord",
        description:
            "Sign in, open your cafe's page and use the Claim button shown on any cafe that is not claimed yet. Signing in is one tap if you use Google or Discord.",
    },
    {
        title: "Tell us who you are",
        highlight: "Permit, DTI or ID · up to 10 MB",
        description:
            "A short note about your role, plus a business permit, DTI registration or an ID if you have one handy. PDF, JPG or PNG up to 10 MB.",
    },
    {
        title: "We review, then email you",
        highlight: "Dashboard unlocks on approval",
        description:
            "A person reads every claim. You get an email either way, and once it is approved your dashboard is ready to use.",
    },
]

export const INCLUDED_HEADING = "Included from day one"

export const INCLUDED_FEATURES: string[] = [
    "Menu items and categories — as many as your menu needs",
    "12 gallery photos — plus a cover image",
    "Review replies — three pinned to the top of your page",
    "Discount campaigns — up to 1,000 voucher codes per batch",
    "Page analytics — across 7, 30 and 90 days",
    "Inventory tracking — low-stock warnings and CSV export",
    "Events and blog posts — posts are reviewed before publishing",
    "Branded QR codes — check-in and menu, ready to print",
    "A custom stamp — collected on every check-in",
]

export const FAQ_HEADING = "Questions cafe owners ask"

export const FAQ_ITEMS: FaqItem[] = [
    {
        question: "Is it really free?",
        answer:
            "Yes. Claiming and managing a cafe costs nothing. There is no subscription, no paid tier, and no commission on anything you sell. Grounds is supported by optional donations from the community, which are unrelated to owning a cafe and change nothing about what you can access.",
    },
    {
        question: "Do you take a cut of my discounts?",
        answer:
            "No. Vouchers are redeemed in your shop by your own staff. Grounds never handles the money and takes nothing from it.",
    },
    {
        question: "How long does claiming take?",
        answer:
            "A person reviews every claim, so it depends on how quickly we can confirm you. You will get an email either way. If you need it moving faster, message us.",
    },
    {
        question: "What proof do you need?",
        answer:
            "A short written explanation of your role, plus a document if you have one. A business permit, DTI registration or a government ID makes it faster — PDF, JPG or PNG up to 10 MB. We may contact you before approving.",
    },
    {
        question: "Can I add a cafe that is not on Grounds yet?",
        answer:
            "Yes. Add it through the submit form. New cafes are reviewed by our team before they go public, so mention in your submission that you own it, or claim the listing once it is live.",
    },
    {
        question: "My cafe is already claimed. What now?",
        answer:
            "Get in touch and we will sort it out. If you are a co-owner, or you have taken over the business, we can add you to the listing.",
    },
    {
        question: "Who can edit my cafe once I claim it?",
        answer:
            "You can. Changes suggested by the community arrive as suggestions and are checked by our moderators before anything changes, so nobody can quietly rewrite your listing.",
    },
    {
        question: "Can I publish events and blog posts?",
        answer:
            "Yes. Events you create for your cafe go live when you publish them. Blog posts are read by our team before they appear publicly.",
    },
    {
        question: "Can I use my own photos and menu?",
        answer:
            "Yes. Upload your own photos and build the menu yourself, or photograph your printed menu and have the items read in for you.",
    },
]

export const CLOSING = {
    heading: "Ready to take the keys?",
    body: "Find your cafe, claim it, and once it is approved you can edit everything yourself. It costs nothing.",
    footnote:
        "Claiming a cafe is subject to our Terms of Service and Content Policy.",
} as const
