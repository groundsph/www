"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import { CafeSocial, OperatingHour } from "@/utils/types/cafe"
import {
    StarIcon,
    WifiIcon,
    PlugIcon,
    CarIcon,
    SnowflakeIcon,
    PawPrintIcon,
    SunIcon,
    MapPin,
    Clock,
    ExternalLink,
    BriefcaseIcon,
    CoffeeIcon,
} from "lucide-react"
import { formatTimeTo12Hour, isOpenNow } from "@/utils/extras"
import dynamic from "next/dynamic"
import RatingDistribution from "./RatingDistribution"
import MarkdownRender from "@/components/MarkdownRender"

// Day mapping
const DAY_NAMES: Record<OperatingHour["day"], string> = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
}

const DAY_ORDER: OperatingHour["day"][] = [
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
    "sun",
]

// Dynamic import for mini map
const DynamicCafeMiniMap = dynamic(() => import("@/components/CafeMiniMap"), {
    ssr: false,
    loading: () => (
        <div className='w-full h-full min-h-[180px] flex items-center justify-center bg-secondary/20 rounded-xl'>
            <p className='text-text/50 font-serif text-sm'>Loading map...</p>
        </div>
    ),
})

interface CafeMobileContentProps {
    cafe: CafeWithRatings
    reviews?: { rating: number }[]
}

/**
 * About Tab Content - Map, address, contact info, hours
 */
export function AboutTabContent({ cafe }: CafeMobileContentProps) {
    const openStatus = isOpenNow(cafe.operating_hours)
    const socials = (cafe.socials as unknown as CafeSocial[]) ?? []
    const story = cafe.story

    return (
        <div className='flex flex-col gap-4'>
            {/* Story */}
            {story ? (
                <div className='w-full'>
                    <MarkdownRender content={story.content} />
                </div>
            ) : (
                <div className='w-full bg-text/5 rounded-xl border border-dashed border-text/20 p-6 text-center'>
                    <p className='text-text/50 font-serif italic'>
                        This cafe&apos;s story is yet to be told...
                    </p>
                    <p className='text-text/40 text-sm mt-1'>
                        Check back later for more about {cafe.name}
                    </p>
                </div>
            )}

            {/* Map */}
            <div className='w-full h-auto aspect-video relative overflow-clip rounded-xl border-2 border-text/10'>
                <DynamicCafeMiniMap
                    key={cafe.id}
                    cafe={cafe}
                />
            </div>

            {/* Address & Directions */}
            <a
                href={`https://www.google.com/maps/search/?api=1&query=${cafe.address_display}`}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-2 p-3 bg-text/5 rounded-xl hover:bg-text/10 transition-colors'
            >
                <MapPin className='w-5 h-5 text-primary shrink-0' />
                <span className='text-sm font-medium flex-1'>
                    {cafe.address_display}
                </span>
                <ExternalLink className='w-4 h-4 text-text/40' />
            </a>

            {/* Operating Hours */}
            <div className='bg-text/5 rounded-xl p-4'>
                <div className='flex items-center gap-2 mb-3'>
                    <Clock className='w-5 h-5 text-primary' />
                    <h3 className='font-semibold font-serif'>Hours</h3>
                    <div
                        className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                            openStatus.isOpen
                                ? "bg-green-500/20 text-green-600"
                                : "bg-text/10 text-text/60"
                        }`}
                    >
                        {openStatus.isOpen ? "Open" : "Closed"}
                    </div>
                </div>

                {cafe.operating_hours && cafe.operating_hours.length > 0 ? (
                    <div className='space-y-1'>
                        {DAY_ORDER.map((day) => {
                            const hours = cafe.operating_hours?.find(
                                (h) => h.day === day
                            )
                            const today = new Date()
                                .toLocaleDateString("en-US", {
                                    weekday: "short",
                                })
                                .toLowerCase()
                                .slice(0, 3)
                            const isToday = day === today

                            return (
                                <div
                                    key={day}
                                    className={`flex justify-between text-sm py-1 px-2 rounded ${
                                        isToday
                                            ? "bg-primary/10 font-semibold"
                                            : ""
                                    }`}
                                >
                                    <span className='text-text/70'>
                                        {DAY_NAMES[day]}
                                    </span>
                                    <span>
                                        {hours ? (
                                            hours.is_closed ? (
                                                <span className='text-text/50'>
                                                    Closed
                                                </span>
                                            ) : (
                                                `${formatTimeTo12Hour(
                                                    hours.open
                                                )} - ${formatTimeTo12Hour(
                                                    hours.close
                                                )}`
                                            )
                                        ) : (
                                            <span className='text-text/50'>
                                                —
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <p className='text-sm text-text/50'>Hours not available</p>
                )}
            </div>

            {/* Contact & Socials */}
            {(cafe.phone ||
                cafe.email ||
                cafe.website_url ||
                socials.length > 0) && (
                <div className='bg-text/5 rounded-xl p-4'>
                    <h3 className='font-semibold font-serif mb-3'>Contact</h3>
                    <div className='space-y-2'>
                        {cafe.website_url && (
                            <a
                                href={cafe.website_url}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='block text-sm text-primary hover:underline truncate'
                            >
                                {cafe.website_url}
                            </a>
                        )}
                        {cafe.phone && (
                            <a
                                href={`tel:${cafe.phone}`}
                                className='block text-sm hover:underline'
                            >
                                {cafe.phone}
                            </a>
                        )}
                        {cafe.email && (
                            <a
                                href={`mailto:${cafe.email}`}
                                className='block text-sm hover:underline'
                            >
                                {cafe.email}
                            </a>
                        )}
                        {socials.length > 0 && (
                            <div className='flex gap-2 pt-2 flex-wrap'>
                                {socials.map((social) => (
                                    <a
                                        key={social.title}
                                        href={social.url}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='text-xs bg-secondary/40 px-2 py-1 rounded-full hover:bg-secondary/60 transition-colors'
                                    >
                                        {social.title}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * Details Tab Content - Amenities, payment, extras
 */
export function DetailsTabContent({
    cafe,
    reviews = [],
}: CafeMobileContentProps) {
    return (
        <div className='flex flex-col gap-4'>
            {/* Price & Rating */}
            <div className='flex gap-3'>
                <div className='flex-1 bg-text/5 rounded-xl p-4 text-center'>
                    <p className='text-xs text-text/60 mb-1'>Price Range</p>
                    <p className='text-2xl font-bold'>
                        {cafe.price_level === "low" && "₱"}
                        {cafe.price_level === "medium" && "₱₱"}
                        {cafe.price_level === "high" && "₱₱₱"}
                    </p>
                </div>
                <div className='flex-1 bg-text/5 rounded-xl p-4 text-center'>
                    <p className='text-xs text-text/60 mb-1'>Rating</p>
                    <div className='flex items-center justify-center gap-1 text-2xl font-bold'>
                        <StarIcon className='w-5 h-5 fill-amber-400 text-amber-400' />
                        {cafe.average_rating
                            ? cafe.average_rating.toFixed(1)
                            : "-"}
                    </div>
                </div>
            </div>

            {/* Rating Distribution */}
            <RatingDistribution reviews={reviews} />

            {/* Amenities */}
            <div className='bg-text/5 rounded-xl p-4'>
                <h3 className='font-semibold font-serif mb-3'>Amenities</h3>
                <div className='flex flex-wrap gap-2'>
                    {cafe.has_wifi && (
                        <span className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full'>
                            <WifiIcon className='w-4 h-4' />
                            WiFi
                        </span>
                    )}
                    {cafe.has_sockets && (
                        <span className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full'>
                            <PlugIcon className='w-4 h-4' />
                            Power Outlets
                        </span>
                    )}
                    {cafe.has_parking && (
                        <span className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full'>
                            <CarIcon className='w-4 h-4' />
                            Parking
                        </span>
                    )}
                    {cafe.has_aircon && (
                        <span className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full'>
                            <SnowflakeIcon className='w-4 h-4' />
                            AC
                        </span>
                    )}
                    {cafe.is_pet_friendly && (
                        <span className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full'>
                            <PawPrintIcon className='w-4 h-4' />
                            Pet Friendly
                        </span>
                    )}
                    {cafe.has_outdoor_seating && (
                        <span className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full'>
                            <SunIcon className='w-4 h-4' />
                            Outdoor
                        </span>
                    )}
                    {cafe.is_work_friendly && (
                        <span className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full'>
                            <BriefcaseIcon className='w-4 h-4' />
                            Work Friendly
                        </span>
                    )}
                    {!cafe.has_wifi &&
                        !cafe.has_sockets &&
                        !cafe.has_parking &&
                        !cafe.has_aircon &&
                        !cafe.is_pet_friendly &&
                        !cafe.has_outdoor_seating &&
                        !cafe.is_work_friendly && (
                            <span className='text-sm text-text/50'>
                                No amenities listed
                            </span>
                        )}
                </div>
            </div>

            {/* Payment Methods */}
            {cafe.payment_methods && (
                <div className='bg-text/5 rounded-xl p-4'>
                    <h3 className='font-semibold font-serif mb-3'>
                        Payment Methods
                    </h3>
                    <div className='flex flex-wrap gap-2'>
                        {cafe.payment_methods.split(" ").map((method) => (
                            <span
                                key={method}
                                className='text-sm bg-text/10 px-3 py-1.5 rounded-full capitalize'
                            >
                                {method.split("_").join(" ")}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Roaster */}
            {cafe.roaster && (
                <div className='bg-text/5 rounded-xl p-4'>
                    <h3 className='font-semibold font-serif mb-2'>Roaster</h3>
                    <p>{cafe.roaster}</p>
                </div>
            )}

            {/* Extras */}
            {((cafe.specialty && cafe.specialty.length > 0) ||
                (cafe.tags && cafe.tags.length > 0) ||
                (cafe.brew_methods && cafe.brew_methods.length > 0) ||
                cafe.serves_food) && (
                <div className='bg-text/5 rounded-xl p-4'>
                    <h3 className='font-semibold font-serif mb-3'>
                        Extras
                        {cafe.serves_food && (
                            <span className='ml-2 text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full'>
                                Serves Food
                            </span>
                        )}
                    </h3>
                    <div className='space-y-3'>
                        {cafe.brew_methods && cafe.brew_methods.length > 0 && (
                            <div>
                                <p className='text-xs text-text/60 mb-1 flex items-center gap-1'>
                                    <CoffeeIcon className='w-3 h-3' />
                                    Brew Methods
                                </p>
                                <div className='flex flex-wrap gap-1.5'>
                                    {cafe.brew_methods.map((method) => (
                                        <span
                                            key={method}
                                            className='text-xs bg-amber-500/20 text-amber-700 px-2 py-1 rounded-full capitalize'
                                        >
                                            {method.split("_").join(" ")}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {cafe.specialty && cafe.specialty.length > 0 && (
                            <div>
                                <p className='text-xs text-text/60 mb-1'>
                                    Specialties
                                </p>
                                <div className='flex flex-wrap gap-1.5'>
                                    {cafe.specialty.map((item) => (
                                        <span
                                            key={item}
                                            className='text-xs bg-primary/20 px-2 py-1 rounded-full capitalize'
                                        >
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {cafe.tags && cafe.tags.length > 0 && (
                            <div>
                                <p className='text-xs text-text/60 mb-1'>
                                    Vibe
                                </p>
                                <div className='flex flex-wrap gap-1.5'>
                                    {cafe.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className='text-xs bg-text/10 px-2 py-1 rounded-full capitalize'
                                        >
                                            {tag.split("_").join(" ")}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
