"use client"

import { CafeSocial, OperatingHour, OperatingHours } from "@/utils/types/cafe"
import { CafeWithRatings } from "@/utils/types/extra"
import Image from "next/image"
import { motion } from "motion/react"
import { useState } from "react"

import {
    ChevronLeftIcon,
    ChevronRightIcon,
    StarIcon,
    WifiIcon,
    PlugIcon,
    CarIcon,
    SnowflakeIcon,
    PawPrintIcon,
    SunIcon,
} from "lucide-react"
import { formatTimeTo12Hour, isOpenNow } from "@/utils/extras"
import dynamic from "next/dynamic"
import MarkdownRender from "@/components/MarkdownRender"

// Day mapping for display
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

// Dynamic import for the mini map to avoid SSR issues
const DynamicCafeMiniMap = dynamic(() => import("@/components/CafeMiniMap"), {
    ssr: false,
    loading: () => (
        <div className='w-full h-full min-h-[180px] flex items-center justify-center bg-secondary/20 rounded-xl'>
            <p className='text-text/50 font-serif text-sm'>Loading map...</p>
        </div>
    ),
})

export default function CafeDetails({ cafe }: { cafe: CafeWithRatings }) {
    // Constant
    const openStatus = isOpenNow(cafe.operating_hours)
    const firstImage = cafe.gallery && cafe.gallery[0]
    const secondImage = cafe.gallery && cafe.gallery[1]
    const thirdImage = cafe.gallery && cafe.gallery[2]
    const remainingImages = cafe.gallery && cafe.gallery.slice(3)

    // States
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // Computed Values
    const story = cafe.story
    const socials = (cafe.socials as unknown as CafeSocial[]) ?? []

    // Render
    return (
        <>
            <section
                id='top'
                className='w-full min-h-[calc(100vh-20rem)] flex flex-col relative'
            >
                {/* Image */}
                <div className='absolute w-full h-full bg-linear-to-r from-black/70 to-transparent select-none'>
                    <Image
                        src={cafe.thumbnail}
                        alt=''
                        fill
                        className='object-cover object-center -z-1'
                        draggable={false}
                    />
                </div>
                {/* Details */}
                <div className='z-1 w-full h-full flex flex-col px-4 py-10 items-center text-background'>
                    <div className='w-full max-w-7xl flex flex-col'>
                        <motion.h1
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 * 0 }}
                            className='text-2xl md:text-5xl font-bold'
                        >
                            {cafe.name}
                        </motion.h1>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 * 1 }}
                            className='flex flex-row items-center gap-2 mt-2 font-serif'
                        >
                            <span className='px-2 py-0.5 rounded-md bg-background/20 text-sm font-semibold'>
                                {cafe.city_municipality}
                            </span>
                            <span className='text-background/60'>•</span>
                            <span className='font-semibold text-lg'>
                                {cafe.province}
                            </span>
                        </motion.div>
                        <motion.h2
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 * 1 }}
                            className='font-serif font-medium text-background/80 max-w-md mt-1 text-sm'
                        >
                            {cafe.address_display}
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 * 2 }}
                            className='max-w-md mt-8'
                        >
                            {cafe.description}
                        </motion.p>
                    </div>
                </div>
            </section>
            <section
                id='body'
                className='w-full flex flex-col md:flex-row items-start justify-start px-4 py-4 relative md:gap-4 overflow-x-clip'
            >
                <div className='flex-1 w-full md:w-auto flex flex-col gap-2'>
                    {/* Images */}
                    <div className='w-full h-max flex flex-col gap-2'>
                        {firstImage && (
                            <>
                                <div className='w-full h-auto aspect-video relative'>
                                    <Image
                                        src={firstImage}
                                        alt=''
                                        fill
                                        className='object-cover object-center'
                                    />
                                </div>
                                {secondImage && (
                                    <div className='w-full h-auto aspect-6/2 flex flex-row gap-2'>
                                        <div className='h-full w-auto aspect-video relative'>
                                            <Image
                                                src={secondImage}
                                                alt=''
                                                fill
                                                className='object-cover object-center'
                                            />
                                        </div>
                                        {thirdImage && (
                                            <div className='flex-1 relative'>
                                                <Image
                                                    src={thirdImage}
                                                    alt=''
                                                    fill
                                                    className='object-cover object-center'
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className='h-1 w-full bg-text/40' />
                            </>
                        )}
                    </div>
                    {/* Story */}
                    <div className='w-full'>
                        {story ? (
                            <MarkdownRender content={story.content} />
                        ) : (
                            <p>No story found</p>
                        )}
                    </div>
                </div>
                <div
                    className={`w-full md:w-auto absolute top-2 md:top-0 z-10 md:relative transition-transform flex flex-col px-2 md:px-0 ${
                        sidebarOpen
                            ? "left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 items-end"
                            : "left-[calc(100%-0.5rem)] md:left-auto md:translate-x-0 items-start"
                    }`}
                >
                    <div className='w-lg max-w-[calc(100svw-1rem)] bg-background rounded-2xl border border-text/10 shadow-sm min-h-screen px-3 py-2 flex flex-col gap-2'>
                        {/* Mobile */}
                        <div
                            className={`w-max h-full absolute md:hidden -left-5 top-2 transform-all z-10 ${
                                sidebarOpen ? "translate-x-4" : ""
                            }`}
                        >
                            <div
                                className={`sticky top-4 shadow-md border border-text/10 aspect-square p-1 bg-background cursor-pointer hover:opacity-60 transition-opacity rounded-full`}
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                            >
                                {sidebarOpen ? (
                                    <ChevronRightIcon className='w-6 h-6 text-text' />
                                ) : (
                                    <ChevronLeftIcon className='w-6 h-6 text-text' />
                                )}
                            </div>
                        </div>
                        {/* Sidebar Content */}
                        <h2 className='text-xl font-semibold pl-4 md:pl-0'>
                            Cafe Info
                        </h2>
                        {/* Map */}
                        <div className='w-full h-auto aspect-video relative flex flex-col items-center justify-center overflow-clip rounded-xl border-2 border-text/10'>
                            <DynamicCafeMiniMap
                                key={cafe.id}
                                cafe={cafe}
                            />
                        </div>
                        <a
                            href={`https://www.google.com/maps/search/?api=1&query=${cafe.address_display}`}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-sm font-semibold text-text/60 hover:text-text/60 transition-colors hover:underline'
                        >
                            {cafe.address_display}
                        </a>
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
                        {socials && socials.length > 0 && (
                            <>
                                <p className='text-sm font-semibold text-text/60'>
                                    Socials
                                </p>
                                <ul className='flex flex-row items-center gap-4 overflow-x-auto text-sm font-semibold text-text/60'>
                                    {socials.map((social) => (
                                        <li key={social.title}>
                                            <a
                                                href={social.url}
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
                        <div className='w-full h-0.5 bg-text/10 mt-2' />
                        <div className='font-semibold text-lg text-text/80 flex flex-row gap-2'>
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
                                        ? `Closes at ${formatTimeTo12Hour(
                                              openStatus.closesAt
                                          )}`
                                        : openStatus.opensAt
                                        ? `Opens at ${
                                              openStatus.opensAt.split(" ")[0]
                                          } ${formatTimeTo12Hour(
                                              openStatus.opensAt.split(" ")[1]
                                          )}`
                                        : ""}
                                </span>
                            </div>
                        </div>

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

                        {cafe.payment_methods && (
                            <>
                                <p className='text-sm font-semibold text-text/60'>
                                    Payment Methods
                                </p>
                                <ul className='flex flex-row items-center gap-4 overflow-x-auto text-sm font-semibold text-text/60'>
                                    {cafe.payment_methods
                                        .split(" ")
                                        .map((method) => (
                                            <li
                                                key={method}
                                                className='text-text capitalize bg-secondary/40 px-2 py-1 rounded-full h-max w-max'
                                            >
                                                {method.split("_").join(" ")}
                                            </li>
                                        ))}
                                </ul>
                            </>
                        )}
                        {cafe.roaster && (
                            <>
                                <p className='text-sm font-semibold text-text/60'>
                                    Roaster
                                </p>
                                <ul className='flex flex-row items-center gap-4 overflow-x-auto text-sm font-semibold text-text/60'>
                                    <li>
                                        <span className='text-text'>
                                            {cafe.roaster}
                                        </span>
                                    </li>
                                </ul>
                            </>
                        )}
                        <div className='w-full h-0.5 bg-text/10 mt-2' />
                        {/* Ratings */}
                        <div className='font-semibold text-lg text-text/80 flex flex-row items-center gap-2'>
                            Ratings
                            <div className='flex flex-row items-center gap-2'>
                                <div className='text-sm font-bold px-2 py-0.5 rounded-lg bg-green-200/40 text-green-700 flex flex-row items-center gap-1'>
                                    <StarIcon className='w-4 h-4 fill-current' />{" "}
                                    {cafe.average_rating
                                        ? cafe.average_rating.toFixed(1)
                                        : "-"}{" "}
                                    / 10
                                </div>
                            </div>
                        </div>
                        <div className='w-full h-0.5 bg-text/10 mt-2' />
                        {/* Amenities */}
                        <div className='font-semibold text-lg text-text/80'>
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
                            {!cafe.has_wifi &&
                                !cafe.has_sockets &&
                                !cafe.has_parking &&
                                !cafe.has_aircon &&
                                !cafe.is_pet_friendly &&
                                !cafe.has_outdoor_seating && (
                                    <li className='text-text/50'>
                                        No amenities listed
                                    </li>
                                )}
                        </ul>
                        <div className='w-full h-0.5 bg-text/10 mt-2' />
                        {/* Extras */}
                        <div className='font-semibold text-lg text-text/80 flex flex-row items-center gap-2'>
                            Extras
                            {cafe.serves_food && (
                                <span className='text-xs text-text/80 bg-secondary/40 px-2 py-1 rounded-lg'>
                                    Serves Food
                                </span>
                            )}
                        </div>
                        <div className='flex flex-col gap-2'>
                            {cafe.specialty && cafe.specialty.length > 0 && (
                                <>
                                    <p className='text-sm font-semibold text-text/60'>
                                        Specialties
                                    </p>
                                    <ul className='flex flex-row flex-wrap items-center gap-2 text-xs font-semibold'>
                                        {cafe.specialty.map((item) => (
                                            <li
                                                key={item}
                                                className='text-text bg-primary/20 px-2 py-1 rounded-full capitalize'
                                            >
                                                {item}
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
                                (!cafe.specialty ||
                                    cafe.specialty.length === 0) &&
                                (!cafe.tags || cafe.tags.length === 0) && (
                                    <p className='text-sm text-text/50'>
                                        No extras listed
                                    </p>
                                )}
                        </div>
                        <div className='w-full h-0.5 bg-text/10 mt-2' />
                        {/* Operating Hours */}
                        <div className='font-semibold text-lg text-text/80'>
                            Operating Hours
                        </div>
                        {cafe.operating_hours &&
                        cafe.operating_hours.length > 0 ? (
                            <table className='w-full text-sm'>
                                <tbody>
                                    {DAY_ORDER.map((day) => {
                                        const hours =
                                            cafe.operating_hours?.find(
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
                            <p className='text-sm text-text/50'>
                                Hours not available
                            </p>
                        )}
                    </div>
                </div>
            </section>
            {remainingImages && remainingImages.length > 0 && (
                <section
                    id='images'
                    className='px-4 py-10 w-full'
                >
                    <div className='font-semibold text-lg text-text/80'>
                        Images
                    </div>
                    <div className='flex flex-row gap-4 flex-wrap py-10 w-full'>
                        {remainingImages.map((image, idx) => (
                            <img
                                key={`${cafe.id}-image-${idx}`}
                                src={image}
                                alt={`${cafe.name} gallery image ${idx + 1}`}
                                className='max-w-screen md:max-w-md'
                            />
                        ))}
                    </div>
                </section>
            )}
        </>
    )
}
