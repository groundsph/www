import type { ReactNode } from "react"
import Image from "next/image"
import {
    AlertTriangle,
    Check,
    Clock,
    Eye,
    MapPin,
    PencilLine,
    QrCode,
    Star,
    Users,
} from "lucide-react"
import { cn } from "@/utils/cn"

/**
 * Simulated app screens for the owner marketing page.
 *
 * Everything here is built from divs and theme tokens — no images, no client
 * JavaScript — so the page stays a single server component. The screens are
 * marked decorative; the section around them carries the real copy.
 *
 * Type sizes run smaller than the rest of the site on purpose: these are
 * miniatures of real dashboard views, not body copy.
 */

/**
 * The demo cafe is a real published listing — The High Grounds Cafe in
 * Lapu-Lapu, Cebu — so the name, area, hours, amenities and photos are its own
 * metadata. Everything else on the screens (views, ratings, menu prices,
 * vouchers, reviews) is mock data written for the illustration.
 */
const DEMO_CAFE = {
    name: "The High Grounds Cafe",
    locality: "Lapu-Lapu, Cebu",
    hours: "Tue to Sun, 10:00 AM to 8:00 PM",
    description:
        "Cozy, yet sophisticated atmosphere, where the room filled with the glorious aroma of freshly brewed coffee and home-made roasted beans.",
    amenities: ["Aircon", "Pet friendly", "Outdoor seating", "₱₱"],
    cover: "/cafes/b7b68b55-f1ac-4677-bdb7-bb832cc28b3e/1766675155071-gdftxr.webp",
    /** Other published listings, used as stand-in gallery tiles. */
    gallery: [
        "/cafes/5d791c21-cdea-491a-8d66-1cc1dc01a3b1/1767422395305-f32bnt.webp",
        "/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766779467523-aadbia.webp",
        "/cafes/1f1d41f2-f978-4e04-9141-3f4af57f4f3a/1779709848574-8s4t01.webp",
        "/cafes/fb15fdae-19a5-4f04-a04e-5a5c9cb05ad9/1767882393486-dvtt4r.webp",
    ],
}

/** Cloudflare image resizing in front of the cafe CDN. */
function cdnPhoto(path: string, width: number, height: number) {
    return `${"https://cdn.grounds.ph/cdn-cgi/image"}/width=${width},height=${height},fit=cover,quality=74,format=auto${path}`
}

const QR_PATTERN = [
    1, 1, 1, 0, 1, 1,
    1, 0, 1, 0, 0, 1,
    1, 1, 1, 1, 0, 0,
    0, 1, 0, 1, 1, 0,
    1, 0, 1, 0, 1, 1,
    1, 1, 0, 1, 0, 0,
]

function QrGlyph({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                "grid grid-cols-6 gap-px rounded-sm bg-background p-1 ring-1 ring-text/15",
                className
            )}
            aria-hidden='true'
        >
            {QR_PATTERN.map((filled, index) => (
                <span
                    key={index}
                    className={cn(
                        "rounded-[1px]",
                        filled === 1 ? "bg-text/80" : "bg-transparent"
                    )}
                />
            ))}
        </span>
    )
}

function Stars({ filled }: { filled: number }) {
    return (
        <span className='inline-flex items-center gap-0.5' aria-hidden='true'>
            {[0, 1, 2, 3, 4].map((index) => (
                <Star
                    key={index}
                    className={cn(
                        "size-2.5",
                        index < filled
                            ? "fill-accent text-accent"
                            : "text-text/25"
                    )}
                    aria-hidden='true'
                />
            ))}
        </span>
    )
}

function Chip({
    children,
    tone = "muted",
}: {
    children: ReactNode
    tone?: "muted" | "solid"
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                tone === "solid"
                    ? "bg-primary text-white"
                    : "bg-text/5 text-text/60"
            )}
        >
            {children}
        </span>
    )
}

function ScreenFrame({ url, children }: { url: string; children: ReactNode }) {
    return (
        <div className='overflow-hidden rounded-2xl bg-background shadow-xl shadow-text/10 ring-1 ring-text/10'>
            <div className='flex items-center gap-1.5 border-b border-text/10 bg-text/5 px-2.5 py-2'>
                <span className='size-2 rounded-full bg-accent/40' />
                <span className='size-2 rounded-full bg-secondary/50' />
                <span className='size-2 rounded-full bg-primary/30' />
                <p className='ml-1.5 truncate text-[10px] font-medium text-text/45'>
                    {url}
                </p>
            </div>
            <div className='p-3 sm:p-3.5'>{children}</div>
        </div>
    )
}

function ListingEditorScreen() {
    const fields = [
        ["Name", DEMO_CAFE.name],
        ["Description", DEMO_CAFE.description],
        ["Hours", DEMO_CAFE.hours],
    ]

    return (
        <ScreenFrame url='grounds.ph/owner/listing'>
            <div className='flex items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='truncate text-[13px] font-semibold text-text'>
                        {DEMO_CAFE.name}
                    </p>
                    <p className='text-[10px] text-text/45'>Listing editor</p>
                </div>
                <Chip tone='solid'>
                    <Check className='size-2.5' aria-hidden='true' />
                    Live
                </Chip>
            </div>

            <div className='relative mt-2.5 h-16 overflow-hidden rounded-lg bg-tertiary/60'>
                <Image
                    src={cdnPhoto(DEMO_CAFE.cover, 640, 320)}
                    alt=''
                    width={640}
                    height={320}
                    sizes='(max-width: 1024px) 100vw, 420px'
                    className='h-full w-full object-cover'
                />
                <span className='absolute bottom-1 right-1 rounded-sm bg-text/70 px-1 py-0.5 text-[9px] font-medium text-background'>
                    Cover
                </span>
            </div>

            <div className='mt-1.5 grid grid-cols-6 gap-1'>
                {DEMO_CAFE.gallery.map((photo) => (
                    <span
                        key={photo}
                        className='relative block h-5 overflow-hidden rounded-sm bg-tertiary/60'
                    >
                        <Image
                            src={cdnPhoto(photo, 80, 80)}
                            alt=''
                            width={80}
                            height={80}
                            sizes='80px'
                            className='h-full w-full object-cover'
                        />
                    </span>
                ))}
                <span className='flex h-5 items-center justify-center rounded-sm bg-text/5 text-[10px] font-semibold text-text/50'>
                    +8
                </span>
            </div>

            <div className='mt-2.5 flex flex-col gap-1'>
                {fields.map(([label, value]) => (
                    <div
                        key={label}
                        className='flex items-center justify-between gap-2 rounded-md bg-text/5 px-2 py-1'
                    >
                        <div className='min-w-0'>
                            <p className='text-[9px] font-semibold uppercase tracking-wider text-text/40'>
                                {label}
                            </p>
                            <p className='truncate text-[11px] text-text/70'>
                                {value}
                            </p>
                        </div>
                        <PencilLine
                            className='size-3 shrink-0 text-text/30'
                            aria-hidden='true'
                        />
                    </div>
                ))}
            </div>

            <div className='mt-2 flex flex-wrap gap-1'>
                {DEMO_CAFE.amenities.map((amenity) => (
                    <Chip key={amenity}>{amenity}</Chip>
                ))}
            </div>

            <div className='mt-2.5 flex items-center justify-between border-t border-text/10 pt-2'>
                <p className='flex items-center gap-1 text-[10px] text-text/45'>
                    <Check className='size-2.5 text-primary' aria-hidden='true' />
                    Saved just now
                </p>
                <span className='rounded-md bg-primary px-1.5 py-1 text-[10px] font-semibold text-white'>
                    View page
                </span>
            </div>
        </ScreenFrame>
    )
}

function DiscoveryScreen() {
    const tabs = ["Photos", "Menu", "Reviews", "Events"]
    const menu = [
        { name: "Spanish latte", meta: "Iced · Large", price: "₱150" },
        { name: "Flat white", meta: "Oat milk · Regular", price: "₱140" },
        { name: "Butter croissant", meta: "Vegetarian", price: "₱95" },
    ]

    return (
        <ScreenFrame url='grounds.ph/cafes/kape-ni-maria'>
            <div className='flex gap-2.5'>
                <div className='relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-tertiary/60'>
                    <Image
                        src={cdnPhoto(DEMO_CAFE.cover, 160, 160)}
                        alt=''
                        width={160}
                        height={160}
                        sizes='56px'
                        className='h-full w-full object-cover'
                    />
                </div>
                <div className='min-w-0 flex-1'>
                    <p className='truncate text-[13px] font-semibold text-text'>
                        {DEMO_CAFE.name}
                    </p>
                    <p className='mt-0.5 flex items-center gap-1 text-[10px] text-text/50'>
                        <MapPin className='size-2.5' aria-hidden='true' />
                        {DEMO_CAFE.locality} · 1.2 km away
                    </p>
                    <p className='mt-1 flex items-center gap-1.5 text-[10px] text-text/55'>
                        <Stars filled={5} />
                        <span className='font-semibold text-text'>4.6</span>
                        84 reviews
                    </p>
                    <p className='mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary'>
                        <Clock className='size-2.5' aria-hidden='true' />
                        Open now
                    </p>
                </div>
            </div>

            <div className='mt-2.5 flex gap-1'>
                {tabs.map((tab, index) => (
                    <span
                        key={tab}
                        className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                            index === 1
                                ? "bg-primary text-white"
                                : "bg-text/5 text-text/50"
                        )}
                    >
                        {tab}
                    </span>
                ))}
            </div>

            <div className='mt-1.5 divide-y divide-text/10 overflow-hidden rounded-lg ring-1 ring-text/10'>
                {menu.map((item) => (
                    <div
                        key={item.name}
                        className='flex items-center justify-between gap-2 px-2 py-1.5'
                    >
                        <div className='min-w-0'>
                            <p className='truncate text-[11px] font-medium text-text'>
                                {item.name}
                            </p>
                            <p className='text-[10px] text-text/45'>
                                {item.meta}
                            </p>
                        </div>
                        <span className='text-[11px] font-semibold text-primary'>
                            {item.price}
                        </span>
                    </div>
                ))}
            </div>

            <div className='mt-1.5 flex items-center gap-2 rounded-lg border border-dashed border-text/15 px-2 py-1.5'>
                <QrGlyph className='size-8' />
                <div className='min-w-0'>
                    <p className='text-[10px] font-medium text-text/70'>
                        Menu QR
                    </p>
                    <p className='truncate text-[10px] text-text/45'>
                        Scan to open this menu
                    </p>
                </div>
            </div>
        </ScreenFrame>
    )
}

function CampaignScreen() {
    return (
        <ScreenFrame url='grounds.ph/owner/discounts'>
            <div className='rounded-lg bg-linear-to-br from-accent/15 to-primary/10 p-2.5 ring-1 ring-text/10'>
                <div className='flex items-start justify-between gap-2'>
                    <div>
                        <p className='text-[15px] font-bold leading-tight text-text'>
                            ₱50 off
                        </p>
                        <p className='text-[10px] text-text/55'>
                            on a ₱300 minimum spend
                        </p>
                    </div>
                    <Chip tone='solid'>
                        <Check className='size-2.5' aria-hidden='true' />
                        Active
                    </Chip>
                </div>
                <div className='mt-1.5 flex flex-wrap gap-1'>
                    <Chip>2 per customer</Chip>
                    <Chip>Until 31 Dec</Chip>
                </div>
                <div className='mt-2 flex items-center justify-between text-[10px] text-text/50'>
                    <span>312 redeemed</span>
                    <span>500 total</span>
                </div>
                <div className='mt-1 h-1.5 overflow-hidden rounded-full bg-background/70'>
                    <div className='h-full w-[62%] rounded-full bg-accent' />
                </div>
            </div>

            <div className='mt-2 flex items-center justify-between gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-2 py-1.5'>
                <div className='min-w-0'>
                    <p className='truncate font-mono text-[11px] font-semibold tracking-widest text-text'>
                        GRND-4K2P
                    </p>
                    <p className='text-[10px] text-text/45'>Unused · single use</p>
                </div>
                <span className='rounded-md bg-primary px-1.5 py-1 text-[10px] font-semibold text-white'>
                    Redeem
                </span>
            </div>

            <div className='mt-1.5 flex items-center gap-2'>
                <div className='flex flex-1 items-center gap-1.5 rounded-lg bg-text/5 px-2 py-1.5'>
                    <QrCode
                        className='size-3.5 shrink-0 text-primary'
                        aria-hidden='true'
                    />
                    <p className='text-[10px] text-text/60'>QR handout</p>
                    <span className='ml-auto text-[10px] font-semibold text-primary'>
                        1,000 codes
                    </span>
                </div>
                <QrGlyph className='size-8' />
            </div>
        </ScreenFrame>
    )
}

function ReviewsScreen() {
    return (
        <ScreenFrame url='grounds.ph/owner/reviews'>
            <div className='flex items-center justify-between gap-2'>
                <p className='text-[13px] font-semibold text-text'>Reviews</p>
                <Chip>3 awaiting reply</Chip>
            </div>

            <div className='mt-1.5 rounded-lg p-2 ring-1 ring-text/10'>
                <div className='flex items-center gap-2'>
                    <span className='flex size-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary'>
                        J
                    </span>
                    <div className='min-w-0'>
                        <p className='text-[11px] font-semibold text-text'>
                            Jonah R.
                        </p>
                        <p className='flex items-center gap-1 text-[9px] text-text/45'>
                            <Stars filled={5} />
                            3 days ago
                        </p>
                    </div>
                    <span className='ml-auto rounded-full bg-text/5 px-1.5 py-0.5 text-[10px] font-medium text-text/55'>
                        Pin
                    </span>
                </div>
                <p className='mt-1 text-[11px] leading-relaxed text-text/65'>
                    “The Spanish latte here is the best in the city.”
                </p>

                <div className='mt-1.5 rounded-md bg-primary/5 p-1.5'>
                    <div className='flex items-center gap-1.5'>
                        <span className='rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-white'>
                            Owner
                        </span>
                        <span className='text-[9px] text-text/45'>
                            replied 2 days ago
                        </span>
                    </div>
                    <p className='mt-1 text-[11px] leading-relaxed text-text/65'>
                        Thanks Jonah — the next batch lands on Friday.
                    </p>
                </div>

                <div className='mt-1.5 flex gap-1'>
                    <span className='inline-flex items-center gap-1 rounded-md bg-text/5 px-1.5 py-0.5 text-[10px] font-medium text-text/60'>
                        <PencilLine className='size-2.5' aria-hidden='true' />
                        Edit reply
                    </span>
                    <span className='rounded-md bg-text/5 px-1.5 py-0.5 text-[10px] font-medium text-text/60'>
                        Remove
                    </span>
                </div>
            </div>

            <div className='mt-1.5 rounded-lg p-1.5 opacity-70 ring-1 ring-text/10'>
                <div className='flex items-center gap-1.5'>
                    <span className='flex size-5 items-center justify-center rounded-full bg-accent/15 text-[9px] font-bold text-accent'>
                        M
                    </span>
                    <p className='text-[10px] font-semibold text-text'>Mika T.</p>
                    <Stars filled={4} />
                    <span className='ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary'>
                        Reply
                    </span>
                </div>
                <p className='mt-1 truncate text-[10px] text-text/55'>
                    Quiet corner, good light, strong wifi.
                </p>
            </div>

            <div className='mt-1.5 flex items-center gap-1'>
                <span className='text-[9px] font-semibold uppercase tracking-wider text-text/40'>
                    Pinned
                </span>
                <span className='rounded-sm bg-tertiary/70 px-1.5 py-0.5 text-[10px] text-text/60'>
                    Best barako
                </span>
                <span className='rounded-sm bg-tertiary/70 px-1.5 py-0.5 text-[10px] text-text/60'>
                    Great staff
                </span>
            </div>
        </ScreenFrame>
    )
}

const VIEW_BARS = [
    { day: "M", height: "h-[14px]" },
    { day: "T", height: "h-[22px]" },
    { day: "W", height: "h-[11px]" },
    { day: "T", height: "h-[28px]" },
    { day: "F", height: "h-[24px]" },
    { day: "S", height: "h-[32px]" },
    { day: "S", height: "h-[18px]" },
]

const RATING_ROWS = [
    { stars: 5, count: 61, width: "w-[88%]" },
    { stars: 4, count: 14, width: "w-[42%]" },
    { stars: 3, count: 5, width: "w-[22%]" },
    { stars: 2, count: 2, width: "w-[12%]" },
    { stars: 1, count: 1, width: "w-[8%]" },
]

const DEVICE_ROWS = [
    { label: "Phones", count: "812", width: "w-[86%]" },
    { label: "Desktops", count: "96", width: "w-[34%]" },
    { label: "Tablets", count: "28", width: "w-[14%]" },
]

function InsightScreen() {
    return (
        <ScreenFrame url='grounds.ph/owner/insights'>
            <div className='grid grid-cols-2 gap-1.5'>
                <div className='rounded-lg bg-text/5 px-2 py-1.5'>
                    <p className='flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-text/40'>
                        <Eye className='size-2.5' aria-hidden='true' />
                        Views
                    </p>
                    <p className='text-[13px] font-bold leading-tight text-text'>
                        1,284
                    </p>
                    <p className='text-[9px] text-text/45'>last 30 days</p>
                </div>
                <div className='rounded-lg bg-text/5 px-2 py-1.5'>
                    <p className='flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-text/40'>
                        <Users className='size-2.5' aria-hidden='true' />
                        Visitors
                    </p>
                    <p className='text-[13px] font-bold leading-tight text-text'>
                        936
                    </p>
                    <p className='text-[9px] text-text/45'>unique</p>
                </div>
            </div>

            <div className='mt-1.5 rounded-lg p-2 ring-1 ring-text/10'>
                <div className='flex items-center justify-between'>
                    <p className='text-[9px] font-semibold uppercase tracking-wider text-text/40'>
                        This week
                    </p>
                    <p className='text-[9px] text-text/40'>7 / 30 / 90</p>
                </div>
                <div className='mt-1 flex h-fit items-end gap-1'>
                    {VIEW_BARS.map((bar, index) => (
                        <div
                            key={index}
                            className='flex flex-1 flex-col items-center justify-end gap-0.5'
                        >
                            <div
                                className={cn(
                                    "w-full rounded-t-sm bg-primary/60",
                                    bar.height
                                )}
                            />
                            <span className='text-[9px] text-text/35'>
                                {bar.day}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className='mt-1.5 rounded-lg p-2 ring-1 ring-text/10'>
                <p className='text-[9px] font-semibold uppercase tracking-wider text-text/40'>
                    Where from
                </p>
                {DEVICE_ROWS.map((row) => (
                    <div key={row.label} className='mt-0.5 flex items-center gap-1.5'>
                        <span className='w-12 shrink-0 text-[10px] text-text/55'>
                            {row.label}
                        </span>
                        <span className='h-1 flex-1 overflow-hidden rounded-full bg-text/10'>
                            <span
                                className={cn(
                                    "block h-full rounded-full bg-accent/70",
                                    row.width
                                )}
                            />
                        </span>
                        <span className='w-5 shrink-0 text-right text-[9px] text-text/45'>
                            {row.count}
                        </span>
                    </div>
                ))}
            </div>

            <div className='mt-1.5 rounded-lg p-2 ring-1 ring-text/10'>
                <div className='flex items-center gap-1.5'>
                    <p className='text-[13px] font-bold text-text'>4.6</p>
                    <Stars filled={5} />
                </div>
                {RATING_ROWS.map((row) => (
                    <div
                        key={row.stars}
                        className='mt-0.5 flex items-center gap-1.5'
                    >
                        <span className='w-2 shrink-0 text-[9px] text-text/45'>
                            {row.stars}
                        </span>
                        <span className='h-1 flex-1 overflow-hidden rounded-full bg-text/10'>
                            <span
                                className={cn(
                                    "block h-full rounded-full bg-primary/50",
                                    row.width
                                )}
                            />
                        </span>
                        <span className='w-4 shrink-0 text-right text-[9px] text-text/40'>
                            {row.count}
                        </span>
                    </div>
                ))}
            </div>

            <div className='mt-1.5 flex items-center gap-1.5 rounded-lg bg-text/5 px-2 py-1.5'>
                <AlertTriangle
                    className='size-3 shrink-0 text-accent'
                    aria-hidden='true'
                />
                <p className='min-w-0 flex-1 truncate text-[10px] text-text/60'>
                    Barako beans
                </p>
                <span className='text-[9px] font-semibold text-accent'>
                    Low stock
                </span>
                <span className='text-[9px] text-text/45'>1.2 kg</span>
            </div>
        </ScreenFrame>
    )
}

const PREVIEWS: Record<string, () => ReactNode> = {
    listing: ListingEditorScreen,
    discovery: DiscoveryScreen,
    customers: CampaignScreen,
    reviews: ReviewsScreen,
    insight: InsightScreen,
}

export function BenefitPreview({ groupId }: { groupId: string }) {
    const Preview = PREVIEWS[groupId]
    if (!Preview) return null

    return (
        <figure className='min-w-0' aria-hidden='true'>
            <Preview />
        </figure>
    )
}

/** The hero screen: a claimed cafe page, mid-campaign. */
export function HeroScreen() {
    const chips = ["Open now", ...DEMO_CAFE.amenities]
    const menu = [
        { name: "Spanish latte", price: "₱150" },
        { name: "Flat white", price: "₱140" },
    ]

    return (
        <div className='relative mx-auto w-full max-w-md'>
            <div className='overflow-hidden rounded-3xl bg-background shadow-2xl shadow-text/20 ring-1 ring-text/10'>
                <div className='relative h-32 overflow-hidden bg-tertiary/60'>
                    <Image
                        src={cdnPhoto(DEMO_CAFE.cover, 880, 480)}
                        alt=''
                        width={880}
                        height={480}
                        sizes='(max-width: 1024px) 90vw, 420px'
                        className='h-full w-full object-cover'
                        preload
                    />
                    <div className='absolute inset-x-3 top-3 flex items-center justify-between'>
                        <span className='rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-primary'>
                            Claimed
                        </span>
                        <span className='rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-primary'>
                            12 photos
                        </span>
                    </div>
                </div>

                <div className='p-4'>
                    <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0'>
                            <p className='truncate text-base font-bold text-text'>
                                {DEMO_CAFE.name}
                            </p>
                            <p className='flex items-center gap-1 text-[11px] text-text/50'>
                                <MapPin className='size-3' aria-hidden='true' />
                                {DEMO_CAFE.locality}
                            </p>
                        </div>
                        <div className='flex shrink-0 items-center gap-1.5'>
                            <span className='rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white'>
                                Owner
                            </span>
                            <span className='inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary'>
                                <Star
                                    className='size-3 fill-accent text-accent'
                                    aria-hidden='true'
                                />
                                4.6
                            </span>
                        </div>
                    </div>

                    <div className='mt-2.5 flex flex-wrap gap-1'>
                        {chips.map((chip) => (
                            <Chip key={chip}>{chip}</Chip>
                        ))}
                    </div>

                    <div className='mt-2.5 divide-y divide-text/10 overflow-hidden rounded-lg ring-1 ring-text/10'>
                        {menu.map((item) => (
                            <div
                                key={item.name}
                                className='flex items-center justify-between gap-2 px-2 py-1.5'
                            >
                                <p className='truncate text-[11px] text-text/70'>
                                    {item.name}
                                </p>
                                <span className='text-[11px] font-semibold text-primary'>
                                    {item.price}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className='mt-2.5 flex items-center justify-end gap-2 border-t border-text/10 pt-2.5'>
                        <span className='text-[11px] text-primary'>
                            Reply to review
                        </span>
                    </div>
                </div>
            </div>

            <div className='absolute -bottom-6 -left-4 hidden w-40 rounded-xl bg-background p-2.5 shadow-xl shadow-text/20 ring-1 ring-text/10 sm:block'>
                <p className='text-[9px] font-semibold uppercase tracking-wider text-text/40'>
                    Campaign live
                </p>
                <p className='text-[13px] font-bold text-text'>₱50 off</p>
                <p className='text-[10px] text-text/50'>312 redeemed</p>
                <div className='mt-1 h-1 overflow-hidden rounded-full bg-text/10'>
                    <div className='h-full w-[62%] rounded-full bg-accent' />
                </div>
            </div>
        </div>
    )
}
