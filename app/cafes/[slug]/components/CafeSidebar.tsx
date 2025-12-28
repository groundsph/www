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
    BriefcaseIcon,
    CoffeeIcon,
    UserIcon,
    CalendarIcon,
    History,
    Toilet,
    Droplet,
    MilkOff,
    Armchair,
} from "lucide-react"
import { formatTimeTo12Hour, isOpenNow } from "@/utils/extras"
import dynamic from "next/dynamic"
import Link from "next/link"
import RatingDistribution from "./RatingDistribution"
import SuggestEditButton from "@/components/suggestions/SuggestEditButton"

// Day mapping and order
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

interface CafeSidebarProps {
    cafe: CafeWithRatings
    reviews?: { rating: number }[]
    onOpenHistory?: () => void
}

export default function CafeSidebar({
    cafe,
    reviews = [],
    onOpenHistory,
}: CafeSidebarProps) {
    const openStatus = isOpenNow(cafe.operating_hours)
    const socials = (cafe.socials as unknown as CafeSocial[]) ?? []

    return (
        <div className='w-full max-w-96 h-fit flex flex-col gap-3 sticky top-4'>
            {/* Map */}
            <div className='w-full h-auto aspect-video relative flex flex-col items-center justify-center overflow-clip rounded-xl border-2 border-text/10'>
                <DynamicCafeMiniMap
                    key={cafe.id}
                    cafe={cafe}
                />
            </div>

            {/* Address Link */}
            <a
                href={`https://www.google.com/maps/search/?api=1&query=${cafe.lat},${cafe.lng}`}
                target='_blank'
                rel='noopener noreferrer'
                className='text-sm font-semibold text-text/60 hover:text-text/60 transition-colors hover:underline'
            >
                {cafe.address_display}
            </a>

            {/* Website */}
            {cafe.website_url && (
                <a
                    href={cafe.website_url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-text hover:text-text/60 transition-colors hover:underline text-sm font-semibold'
                >
                    {cafe.website_url}
                </a>
            )}

            {/* Socials */}
            {socials && socials.length > 0 && (
                <>
                    <p className='text-sm font-semibold text-text/60'>
                        Socials
                    </p>
                    <ul className='flex flex-row items-center gap-4 overflow-x-auto text-sm font-semibold text-text/60'>
                        {socials.map((social) => (
                            <li key={social.title}>
                                <a
                                    href={
                                        social.url.startsWith("http://") ||
                                        social.url.startsWith("https://")
                                            ? social.url
                                            : `https://${social.url}`
                                    }
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-text hover:text-text/60 transition-colors hover:underline'
                                >
                                    {social.title}
                                </a>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {/* Contact */}
            {(cafe.phone || cafe.email) && (
                <>
                    <p className='text-sm font-semibold text-text/60'>
                        Contact
                    </p>
                    <ul className='flex flex-row items-center gap-4 overflow-x-auto text-sm font-semibold text-text/60'>
                        {cafe.phone && (
                            <li>
                                <a
                                    href={`tel:${cafe.phone}`}
                                    className='text-text hover:text-text/60 transition-colors hover:underline text-sm font-semibold'
                                >
                                    {cafe.phone}
                                </a>
                            </li>
                        )}
                        {cafe.email && (
                            <li>
                                <a
                                    href={`mailto:${cafe.email}`}
                                    className='text-text hover:text-text/60 transition-colors hover:underline text-sm font-semibold'
                                >
                                    {cafe.email}
                                </a>
                            </li>
                        )}
                    </ul>
                </>
            )}

            <div className='border-b border-text/10 my-3' />

            {/* Details Section */}
            <div className='font-semibold text-lg font-serif text-text flex flex-row gap-2'>
                Details{" "}
                <div className='flex flex-row gap-2 items-center'>
                    <div
                        className={`text-sm font-bold px-2 py-0.5 rounded-lg ${
                            openStatus.isOpen
                                ? "bg-green-200/40 text-green-700"
                                : "bg-text/10 text-text"
                        }`}
                    >
                        {openStatus.isOpen ? "Open" : "Closed"}
                    </div>
                    <span className='text-xs font-semibold text-text/60'>
                        {openStatus.isOpen
                            ? openStatus.closesAt
                                ? `Closes at ${openStatus.closesAt}`
                                : "Open 24/7"
                            : openStatus.opensAt
                              ? `Opens at ${openStatus.opensAt}`
                              : ""}
                    </span>
                </div>
            </div>

            {/* Price Range */}
            <div className='flex flex-row items-center gap-2'>
                <p className='text-sm font-semibold text-text/60'>
                    Price Range
                </p>
                <span className='text-sm font-bold text-text'>
                    {cafe.price_level === "low" && "₱"}
                    {cafe.price_level === "medium" && "₱₱"}
                    {cafe.price_level === "high" && "₱₱₱"}
                </span>
            </div>

            {/* Payment Methods */}
            {cafe.payment_methods && (
                <>
                    <p className='text-sm font-semibold text-text/60'>
                        Payment Methods
                    </p>
                    <ul className='flex flex-row items-center gap-4 flex-wrap text-sm font-semibold text-text/60'>
                        {cafe.payment_methods
                            .split(",")
                            .map((method) => method.trim())
                            .filter(Boolean)
                            .map((method) => (
                                <li
                                    key={method}
                                    className='text-text capitalize bg-secondary/40 px-2 py-1 rounded-full h-max w-max text-nowrap'
                                >
                                    {method.split("_").join(" ")}
                                </li>
                            ))}
                    </ul>
                </>
            )}

            {/* Roaster */}
            {cafe.roaster && (
                <>
                    <p className='text-sm font-semibold text-text/60'>
                        Roaster
                    </p>
                    <ul className='flex flex-row items-center gap-4 overflow-x-auto text-sm font-semibold text-text/60'>
                        <li>
                            <span className='text-text'>{cafe.roaster}</span>
                        </li>
                    </ul>
                </>
            )}

            <div className='border-b border-text/10 my-3' />

            {/* Ratings */}
            <div className='font-semibold text-lg font-serif text-text flex flex-row items-center gap-2'>
                Ratings
                <div className='flex flex-row items-center gap-2'>
                    <div className='text-sm font-bold px-2 py-0.5 rounded-lg bg-green-200/40 text-green-700 flex flex-row items-center gap-1'>
                        <StarIcon className='w-4 h-4 fill-current' />{" "}
                        {cafe.average_rating
                            ? cafe.average_rating.toFixed(1)
                            : "-"}{" "}
                        / 5
                    </div>
                </div>
            </div>

            {/* Rating Distribution */}
            <RatingDistribution reviews={reviews} />

            <div className='border-b border-text/10 my-3' />

            {/* Amenities */}
            <div className='font-semibold text-lg font-serif text-text'>
                Amenities
            </div>
            <ul className='flex flex-row flex-wrap items-center gap-2 text-sm font-semibold'>
                {cafe.has_wifi && (
                    <li className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1'>
                        <WifiIcon className='w-4 h-4' />
                        WiFi
                    </li>
                )}
                {cafe.has_sockets && (
                    <li className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1'>
                        <PlugIcon className='w-4 h-4' />
                        Power Outlets
                    </li>
                )}
                {cafe.has_parking && (
                    <li className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1'>
                        <CarIcon className='w-4 h-4' />
                        Parking
                    </li>
                )}
                {cafe.has_aircon && (
                    <li className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1'>
                        <SnowflakeIcon className='w-4 h-4' />
                        Air Conditioning
                    </li>
                )}
                {cafe.is_pet_friendly && (
                    <li className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1'>
                        <PawPrintIcon className='w-4 h-4' />
                        Pet Friendly
                    </li>
                )}
                {cafe.has_outdoor_seating && (
                    <li className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1'>
                        <SunIcon className='w-4 h-4' />
                        Outdoor Seating
                    </li>
                )}
                {cafe.has_indoor_seating && (
                    <li className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1'>
                        <Armchair className='w-4 h-4' />
                        Indoor Seating
                    </li>
                )}
                {cafe.has_restroom && (
                    <li className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1'>
                        <Toilet className='w-4 h-4' />
                        Restroom
                    </li>
                )}
                {cafe.has_bidet && (
                    <li className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1'>
                        <Droplet className='w-4 h-4' />
                        Bidet
                    </li>
                )}
                {cafe.has_non_dairy && (
                    <li className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1'>
                        <MilkOff className='w-4 h-4' />
                        Non-Dairy Milk
                        {cafe.milk_options && cafe.milk_options.length > 0 && (
                            <span className='text-xs text-text/60'>
                                ({cafe.milk_options.join(", ")})
                            </span>
                        )}
                    </li>
                )}
                {cafe.is_work_friendly && (
                    <li className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1'>
                        <BriefcaseIcon className='w-4 h-4' />
                        Work Friendly
                    </li>
                )}
                {!cafe.has_wifi &&
                    !cafe.has_sockets &&
                    !cafe.has_parking &&
                    !cafe.has_aircon &&
                    !cafe.is_pet_friendly &&
                    !cafe.has_outdoor_seating &&
                    !cafe.has_indoor_seating &&
                    !cafe.has_restroom &&
                    !cafe.has_bidet &&
                    !cafe.has_non_dairy &&
                    !cafe.is_work_friendly && (
                        <li className='text-text/50'>No amenities listed</li>
                    )}
            </ul>

            <div className='border-b border-text/10 my-3' />

            {/* Extras */}
            <div className='font-semibold text-lg font-serif text-text flex flex-row items-center gap-2'>
                Extras
                {cafe.serves_food && (
                    <span className='text-xs text-text/80 bg-secondary/40 px-2 py-1 rounded-lg'>
                        Serves Food
                    </span>
                )}
            </div>
            <div className='flex flex-col gap-2'>
                {cafe.brew_methods && cafe.brew_methods.length > 0 && (
                    <>
                        <p className='text-sm font-semibold text-text/60 flex items-center gap-1'>
                            <CoffeeIcon className='w-3.5 h-3.5' />
                            Brew Methods
                        </p>
                        <ul className='flex flex-row flex-wrap items-center gap-2 text-xs font-semibold'>
                            {cafe.brew_methods.map((method) => (
                                <li
                                    key={method}
                                    className='text-amber-700 bg-amber-500/20 px-2 py-1 rounded-full capitalize'
                                >
                                    {method.split("_").join(" ")}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                {cafe.specialty && cafe.specialty.length > 0 && (
                    <>
                        <p className='text-sm font-semibold text-text/60'>
                            Specialties
                        </p>
                        <ul className='flex flex-row flex-wrap items-center gap-2 text-xs font-semibold'>
                            {cafe.specialty.map((item) => (
                                <li
                                    key={item}
                                    className='text-text bg-primary/20 px-2 py-1 rounded-full capitalize text-nowrap'
                                >
                                    {item.split("_").join(" ")}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                {cafe.tags && cafe.tags.length > 0 && (
                    <>
                        <p className='text-sm font-semibold text-text/60'>
                            Vibe
                        </p>
                        <ul className='flex flex-row flex-wrap items-center gap-2 text-xs font-semibold'>
                            {cafe.tags.map((tag) => (
                                <li
                                    key={tag}
                                    className='text-text/80 bg-text/10 px-2 py-1 rounded-full capitalize'
                                >
                                    {tag.split("_").join(" ")}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                {!cafe.serves_food &&
                    (!cafe.specialty || cafe.specialty.length === 0) &&
                    (!cafe.tags || cafe.tags.length === 0) &&
                    (!cafe.brew_methods || cafe.brew_methods.length === 0) && (
                        <p className='text-sm text-text/50'>No extras listed</p>
                    )}
            </div>

            <div className='border-b border-text/10 my-3' />

            {/* Operating Hours */}
            <div className='font-semibold text-lg font-serif text-text'>
                Operating Hours
            </div>
            {cafe.operating_hours && cafe.operating_hours.length > 0 ? (
                <table className='w-full text-sm'>
                    <tbody>
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
                                <tr
                                    key={day}
                                    className={`border-b border-text/5 last:border-b-0 ${
                                        isToday
                                            ? "bg-primary/10 font-semibold"
                                            : ""
                                    }`}
                                >
                                    <td className='py-1.5 pl-2 pr-3 text-text/70'>
                                        {DAY_NAMES[day]}
                                    </td>
                                    <td className='py-1.5 text-right text-text pr-2'>
                                        {hours ? (
                                            hours.is_closed ? (
                                                <span className='text-text/50'>
                                                    Closed
                                                </span>
                                            ) : hours.is_24_hours ? (
                                                <span className='text-primary font-medium'>
                                                    24 Hours
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
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            ) : (
                <p className='text-sm text-text/50'>Hours not available</p>
            )}

            <div className='border-b border-text/10 my-3' />

            {/* Last Updated & Scouted By */}
            <div className='space-y-2'>
                {cafe.updated_at && (
                    <div className='flex items-center gap-2 text-sm text-text/60'>
                        <CalendarIcon className='w-4 h-4' />
                        <span>
                            Last updated{" "}
                            {new Date(cafe.updated_at).toLocaleDateString(
                                "en-US",
                                {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                }
                            )}
                        </span>
                        {onOpenHistory && (
                            <button
                                onClick={onOpenHistory}
                                className='ml-auto flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer'
                            >
                                <History className='w-3.5 h-3.5' />
                                View history
                            </button>
                        )}
                    </div>
                )}
                {cafe.contributor && (
                    <div className='flex items-center gap-2 text-sm text-text/60'>
                        <UserIcon className='w-4 h-4' />
                        <span>Scouted by</span>
                        <Link
                            href={`/profile/${cafe.contributor.username}`}
                            className='font-semibold text-text hover:text-accent transition-colors hover:underline'
                        >
                            {cafe.contributor.display_name ||
                                cafe.contributor.username}
                        </Link>
                    </div>
                )}
            </div>

            <div className='border-b border-text/10 my-3' />

            {/* Suggest Edit */}
            <div className='flex justify-center'>
                <SuggestEditButton
                    cafe={cafe}
                    variant='compact'
                />
            </div>
        </div>
    )
}
