import React, { useState, useEffect } from "react"
import {
    Wifi,
    BatteryCharging,
    Users,
    Clock,
    MapPin,
    Star,
    ChevronRight,
    Globe,
    Instagram,
    Share2,
    Heart,
    Coffee,
    CheckCircle2,
    Navigation,
    MessageSquare,
    Search,
    ChevronDown,
    Facebook,
    CreditCard,
    Banknote,
    Smartphone,
    ImageIcon,
    Maximize2,
    Zap,
} from "lucide-react"

const App = () => {
    const [activeTab, setActiveTab] = useState("overview")
    const [photoFilter, setPhotoFilter] = useState("all")

    const cafe = {
        name: "MERCI Bakery & Brunch",
        location: "Mandaue City • Cebu",
        rating: 3.0,
        priceRange: "₱₱",
        status: "Closed",
        description:
            "If you're into aesthetic cafes and good pastries, MERCI Bakery & Brunch is a must-visit. With three floors to explore, including a rooftop and a greenhouse area, it's perfect for catching up with friends or snapping cute photos.",
        amenities: [
            { name: "Parking", icon: <MapPin size={14} /> },
            {
                name: "Air Conditioning",
                icon: (
                    <div className='w-3 h-3 border border-current rounded-full' />
                ),
            },
            { name: "Outdoor Seating", icon: <Coffee size={14} /> },
            { name: "Indoor Seating", icon: <Users size={14} /> },
            { name: "Restroom", icon: <CheckCircle2 size={14} /> },
        ],
        hours: [
            { day: "Monday", time: "7:00 AM - 10:00 PM" },
            { day: "Tuesday", time: "7:00 AM - 10:00 PM", active: true },
            { day: "Wednesday", time: "7:00 AM - 10:00 PM" },
            { day: "Thursday", time: "7:00 AM - 10:00 PM" },
            { day: "Friday", time: "7:00 AM - 11:00 PM" },
            { day: "Saturday", time: "7:00 AM - 11:00 PM" },
            { day: "Sunday", time: "7:00 AM - 11:00 PM" },
        ],
        gallery: [
            {
                id: 1,
                type: "interior",
                url: "https://images.unsplash.com/photo-1554118811-1e0d58224f24",
                tag: "Great Lighting",
            },
            {
                id: 2,
                type: "interior",
                url: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8",
                tag: "Power Outlets",
            },
            {
                id: 3,
                type: "food",
                url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
                tag: "Best Seller",
            },
            {
                id: 4,
                type: "menu",
                url: "https://images.unsplash.com/photo-1550966841-3ee7ad6b1054",
            },
            {
                id: 5,
                type: "interior",
                url: "https://images.unsplash.com/photo-1521017432531-fbd92d744264",
                tag: "Quiet Area",
            },
        ],
    }

    const filteredPhotos =
        photoFilter === "all"
            ? cafe.gallery
            : cafe.gallery.filter((p) => p.type === photoFilter)

    return (
        <div className='min-h-screen bg-[#FDFBF7] font-sans text-[#2D2D2D]'>
            {/* Navbar - Matching grounds.ph header */}
            <nav className='bg-[#1A1A1A] text-white px-6 py-3 border-b border-white/10 sticky top-0 z-50'>
                <div className='max-w-[1400px] mx-auto flex items-center justify-between'>
                    <div className='flex items-center gap-8'>
                        <div className='text-2xl font-bold tracking-tight'>
                            Grounds<span className='text-[#D4AF37]'>.ph</span>
                        </div>
                        <div className='hidden lg:flex items-center gap-6 text-sm font-medium text-gray-300'>
                            <a
                                href='#'
                                className='hover:text-white transition-colors'
                            >
                                home
                            </a>
                            <a
                                href='#'
                                className='hover:text-white transition-colors text-white'
                            >
                                cafes
                            </a>
                            <a
                                href='#'
                                className='hover:text-white transition-colors'
                            >
                                map
                            </a>
                            <div className='flex items-center gap-1 cursor-pointer hover:text-white'>
                                community <ChevronDown size={14} />
                            </div>
                        </div>
                    </div>

                    <div className='flex-1 max-w-md mx-10 relative hidden md:block'>
                        <div className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'>
                            <Search size={16} />
                        </div>
                        <input
                            type='text'
                            placeholder='Search...'
                            className='w-full bg-white/10 border border-white/20 rounded-md py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:bg-white/20 transition-all'
                        />
                        <div className='absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-white/20 px-1 rounded text-gray-300 uppercase'>
                            K
                        </div>
                    </div>

                    <div className='flex items-center gap-4 text-sm font-medium'>
                        <button className='hover:text-[#D4AF37]'>Login</button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className='relative h-[480px] w-full overflow-hidden'>
                <img
                    src='https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=2000'
                    className='w-full h-full object-cover'
                    alt='Cafe Interior'
                />
                <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20' />

                <div className='absolute bottom-0 left-0 w-full p-12'>
                    <div className='max-w-[1200px] mx-auto'>
                        <div className='flex items-center gap-2 mb-4'>
                            <span className='px-3 py-1 bg-[#D4AF37] text-black text-[10px] font-bold uppercase rounded flex items-center gap-1'>
                                <Star
                                    size={10}
                                    fill='black'
                                />{" "}
                                Hidden Gem
                            </span>
                        </div>
                        <h1 className='text-5xl font-bold text-white mb-2 tracking-tight'>
                            {cafe.name}
                        </h1>
                        <div className='flex flex-wrap items-center gap-4 text-white/90 text-sm'>
                            <span className='flex items-center gap-1'>
                                <MapPin size={16} /> {cafe.location}
                            </span>
                            <span className='opacity-50'>•</span>
                            <div className='flex items-center gap-1.5'>
                                <span className='px-2 py-0.5 bg-neutral-800 rounded border border-white/20 text-xs font-bold'>
                                    {cafe.status}
                                </span>
                                <span className='px-2 py-0.5 bg-neutral-800 rounded border border-white/20 text-xs font-bold text-[#D4AF37]'>
                                    {cafe.priceRange}
                                </span>
                                <span className='px-2 py-0.5 bg-[#D4AF37] text-black rounded text-xs font-bold flex items-center gap-1'>
                                    <Star
                                        size={10}
                                        fill='black'
                                    />{" "}
                                    {cafe.rating}
                                </span>
                            </div>
                        </div>
                        <div className='mt-6 flex gap-3'>
                            <button className='p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-md text-white transition-all'>
                                <Share2 size={18} />
                            </button>
                        </div>
                        <p className='mt-6 text-white/80 max-w-2xl leading-relaxed text-sm'>
                            {cafe.description}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Layout */}
            <div className='max-w-[1200px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10'>
                {/* Left Sidebar (Details) */}
                <aside className='lg:col-span-3 space-y-10'>
                    <div className='space-y-6'>
                        <div className='p-4 bg-white border border-neutral-200 rounded-lg shadow-sm'>
                            <div className='flex items-center gap-2 text-[#D4AF37] font-bold text-xs uppercase mb-3'>
                                <Star
                                    size={14}
                                    fill='#D4AF37'
                                />{" "}
                                Hidden Gem
                            </div>
                            <p className='text-[11px] leading-relaxed text-neutral-500'>
                                The MERCI Bakery & Brunch is a long title cafe
                                and it's not fast talking so we are some space
                                for text. Up to the ends notes as they say it's
                                right.
                            </p>
                        </div>

                        <section>
                            <h4 className='text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3'>
                                Socials
                            </h4>
                            <div className='flex flex-col gap-2 text-sm'>
                                <a
                                    href='#'
                                    className='flex items-center gap-2 text-neutral-600 hover:text-[#D4AF37]'
                                >
                                    <Instagram size={14} /> Instagram
                                </a>
                                <a
                                    href='#'
                                    className='flex items-center gap-2 text-neutral-600 hover:text-[#D4AF37]'
                                >
                                    <Facebook size={14} /> Facebook
                                </a>
                            </div>
                        </section>

                        <section className='pt-4 border-t border-neutral-100'>
                            <div className='space-y-3'>
                                <div className='flex justify-between items-center text-sm'>
                                    <span className='text-neutral-400'>
                                        Price Range
                                    </span>
                                    <span className='font-bold text-[#D4AF37]'>
                                        {cafe.priceRange}
                                    </span>
                                </div>
                                <div className='space-y-2'>
                                    <span className='text-[10px] font-bold uppercase tracking-widest text-neutral-400'>
                                        Payment Methods
                                    </span>
                                    <div className='flex flex-wrap gap-1.5'>
                                        {[
                                            "Cash",
                                            "Credit Card",
                                            "Debit Card",
                                            "GCash",
                                        ].map((method) => (
                                            <span
                                                key={method}
                                                className='px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-[10px] font-medium'
                                            >
                                                {method}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className='pt-4 border-t border-neutral-100'>
                            <h4 className='text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center justify-between'>
                                Ratings{" "}
                                <span className='text-[#D4AF37] font-bold'>
                                    {cafe.rating}/5.0
                                </span>
                            </h4>
                            <div className='space-y-2'>
                                {[5, 4, 3, 2, 1].map((num) => (
                                    <div
                                        key={num}
                                        className='flex items-center gap-2 text-[10px]'
                                    >
                                        <span className='w-2'>{num}</span>
                                        <div className='flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden'>
                                            <div
                                                className='h-full bg-yellow-400 rounded-full'
                                                style={{
                                                    width:
                                                        num === 3
                                                            ? "70%"
                                                            : num > 3
                                                              ? "10%"
                                                              : "5%",
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className='pt-4 border-t border-neutral-100'>
                            <h4 className='text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-4'>
                                Operating Hours
                            </h4>
                            <div className='space-y-2'>
                                {cafe.hours.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex justify-between text-[11px] ${item.active ? "font-bold text-neutral-900 bg-yellow-50 -mx-2 px-2 py-1 rounded" : "text-neutral-500"}`}
                                    >
                                        <span>{item.day}</span>
                                        <span>{item.time}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </aside>

                {/* Right Content Area */}
                <div className='lg:col-span-9 space-y-12'>
                    {/* Photos Section */}
                    <section className='space-y-6'>
                        <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                            <div className='flex items-center gap-6'>
                                <h3 className='text-xl font-bold'>Photos</h3>
                                <div className='flex gap-4 border-l border-neutral-200 pl-6'>
                                    {["all", "interior", "food", "menu"].map(
                                        (type) => (
                                            <button
                                                key={type}
                                                onClick={() =>
                                                    setPhotoFilter(type)
                                                }
                                                className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${photoFilter === type ? "text-[#D4AF37]" : "text-neutral-400 hover:text-neutral-600"}`}
                                            >
                                                {type}
                                            </button>
                                        ),
                                    )}
                                </div>
                            </div>
                            <button className='flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500 hover:text-black transition-colors'>
                                <Maximize2 size={14} /> Full Gallery
                            </button>
                        </div>

                        {/* Mosaic Photo Grid */}
                        <div className='grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-3 h-[450px]'>
                            {/* Large Featured Photo */}
                            <div className='md:col-span-2 md:row-span-2 relative group cursor-pointer rounded-xl overflow-hidden shadow-sm'>
                                <img
                                    src={
                                        cafe.gallery[0].url +
                                        "?auto=format&fit=crop&q=80&w=800"
                                    }
                                    className='w-full h-full object-cover transition-transform duration-700 group-hover:scale-105'
                                    alt='Featured Interior'
                                />
                                <div className='absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors' />
                                {cafe.gallery[0].tag && (
                                    <div className='absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md text-white rounded-lg text-[10px] font-bold uppercase tracking-wider'>
                                        <CheckCircle2
                                            size={12}
                                            className='text-[#D4AF37]'
                                        />{" "}
                                        {cafe.gallery[0].tag}
                                    </div>
                                )}
                            </div>

                            {/* Smaller Photos */}
                            {cafe.gallery.slice(1, 4).map((p, idx) => (
                                <div
                                    key={p.id}
                                    className='relative group cursor-pointer rounded-xl overflow-hidden shadow-sm'
                                >
                                    <img
                                        src={
                                            p.url +
                                            "?auto=format&fit=crop&q=80&w=400"
                                        }
                                        className='w-full h-full object-cover transition-transform duration-700 group-hover:scale-110'
                                        alt={`Cafe ${p.type}`}
                                    />
                                    <div className='absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors' />
                                    {p.tag && (
                                        <div className='absolute top-3 right-3 p-1.5 bg-white/90 backdrop-blur-sm rounded shadow-sm text-neutral-800 transition-opacity opacity-0 group-hover:opacity-100'>
                                            <Zap
                                                size={12}
                                                fill='#D4AF37'
                                                className='text-[#D4AF37]'
                                            />
                                        </div>
                                    )}
                                    {p.tag && (
                                        <div className='absolute bottom-3 left-3 px-2 py-1 bg-black/40 backdrop-blur-sm text-white rounded text-[9px] font-bold uppercase'>
                                            {p.tag}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* "View All" Card */}
                            <div className='relative group cursor-pointer rounded-xl overflow-hidden border-2 border-dashed border-neutral-200 bg-neutral-50 flex flex-col items-center justify-center gap-3 hover:bg-neutral-100 hover:border-[#D4AF37] transition-all'>
                                <div className='w-12 h-12 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-400 shadow-sm group-hover:scale-110 transition-transform'>
                                    <ImageIcon size={20} />
                                </div>
                                <div className='text-center'>
                                    <p className='text-[11px] font-bold uppercase tracking-widest text-neutral-600'>
                                        +19 Photos
                                    </p>
                                    <p className='text-[9px] text-neutral-400 mt-0.5'>
                                        View full gallery
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Amenities & Vibe */}
                    <div className='grid md:grid-cols-2 gap-8 p-8 bg-white border border-neutral-200 rounded-xl shadow-sm'>
                        <section>
                            <h3 className='text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-5'>
                                Workspace Essentials
                            </h3>
                            <div className='flex flex-wrap gap-2'>
                                {cafe.amenities.map((amenity) => (
                                    <div
                                        key={amenity.name}
                                        className='flex items-center gap-2 px-3 py-1.5 bg-neutral-50 border border-neutral-100 rounded-lg text-xs font-medium hover:border-[#D4AF37] hover:bg-white transition-all cursor-default'
                                    >
                                        <span className='text-[#D4AF37]'>
                                            {amenity.icon}
                                        </span>
                                        {amenity.name}
                                    </div>
                                ))}
                            </div>
                        </section>
                        <section>
                            <h3 className='text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-5'>
                                Atmosphere
                            </h3>
                            <div className='flex flex-wrap gap-2'>
                                {[
                                    "Aesthetic",
                                    "Instagram Worthy",
                                    "Quiet",
                                    "Modern",
                                ].map((vibe) => (
                                    <div
                                        key={vibe}
                                        className='px-3 py-1.5 bg-neutral-50 border border-neutral-100 rounded-lg text-xs font-medium hover:border-[#D4AF37] hover:bg-white transition-all cursor-default'
                                    >
                                        {vibe}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Reviews Section */}
                    <section className='space-y-6'>
                        <div className='flex items-center justify-between border-b border-neutral-200 pb-4'>
                            <h3 className='text-xl font-bold'>
                                Community Feedback
                            </h3>
                            <button className='text-[10px] font-bold uppercase tracking-widest border-2 border-black px-4 py-2 rounded hover:bg-black hover:text-white transition-all'>
                                Write Review
                            </button>
                        </div>

                        <div className='p-6 bg-white border border-neutral-200 rounded-xl space-y-5 shadow-sm'>
                            <div className='flex justify-between items-start'>
                                <div className='flex gap-3'>
                                    <div className='w-10 h-10 bg-[#D4AF37] rounded-full flex items-center justify-center font-bold text-black border-2 border-white shadow-sm'>
                                        BS
                                    </div>
                                    <div>
                                        <h5 className='font-bold text-sm'>
                                            Banner Sanchez
                                        </h5>
                                        <p className='text-[10px] text-neutral-400 uppercase tracking-widest font-semibold'>
                                            Local Guide • 4 days ago
                                        </p>
                                    </div>
                                </div>
                                <div className='flex text-yellow-400 gap-0.5'>
                                    <Star
                                        size={12}
                                        fill='currentColor'
                                    />
                                    <Star
                                        size={12}
                                        fill='currentColor'
                                    />
                                    <Star
                                        size={12}
                                        fill='currentColor'
                                    />
                                    <Star
                                        size={12}
                                        className='text-neutral-200'
                                    />
                                    <Star
                                        size={12}
                                        className='text-neutral-200'
                                    />
                                </div>
                            </div>
                            <p className='text-sm text-neutral-600 leading-relaxed italic border-l-2 border-[#D4AF37] pl-4'>
                                "Two pastries for me 👍 and the hot chocolate is
                                so good inside. However, the whole interior wall
                                is bright giving me a bit of eye strain."
                            </p>
                            <div className='flex gap-3'>
                                <div className='w-24 h-24 rounded-lg overflow-hidden border border-neutral-200 shadow-sm cursor-zoom-in group'>
                                    <img
                                        src='https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=200'
                                        className='w-full h-full object-cover group-hover:scale-110 transition-transform'
                                        alt='Review'
                                    />
                                </div>
                            </div>
                            <div className='flex items-center gap-6 pt-2'>
                                <button className='text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-[#D4AF37] flex items-center gap-1.5 transition-colors'>
                                    <Heart size={14} /> Helpful (2)
                                </button>
                                <button className='text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black flex items-center gap-1.5 transition-colors'>
                                    <MessageSquare size={14} /> Reply
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* Footer - Consistent with Grounds.ph */}
            <footer className='bg-[#1A1A1A] text-white pt-20 pb-10 mt-20'>
                <div className='max-w-[1200px] mx-auto px-6'>
                    <div className='grid grid-cols-1 md:grid-cols-4 gap-12 mb-16'>
                        <div className='md:col-span-2'>
                            <div className='text-3xl font-bold mb-6'>
                                Grounds
                                <span className='text-[#D4AF37]'>.ph</span>
                            </div>
                            <p className='text-gray-400 text-sm max-w-sm leading-relaxed'>
                                Discover and explore the best cafes and the
                                chillest places in the community with our guide
                                featuring daily highlights, honest reviews, and
                                hidden gems waiting to be found.
                            </p>
                            <div className='mt-6 flex gap-4 text-gray-400'>
                                <Instagram
                                    size={20}
                                    className='hover:text-white cursor-pointer'
                                />
                                <Facebook
                                    size={20}
                                    className='hover:text-white cursor-pointer'
                                />
                            </div>
                        </div>
                        <div>
                            <h6 className='text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-6'>
                                Explore
                            </h6>
                            <ul className='space-y-4 text-sm text-gray-400'>
                                <li>
                                    <a
                                        href='#'
                                        className='hover:text-white'
                                    >
                                        cafes
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href='#'
                                        className='hover:text-white'
                                    >
                                        favorites
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href='#'
                                        className='hover:text-white'
                                    >
                                        events
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href='#'
                                        className='hover:text-white'
                                    >
                                        blog
                                    </a>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h6 className='text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-6'>
                                Legal
                            </h6>
                            <ul className='space-y-4 text-sm text-gray-400'>
                                <li>
                                    <a
                                        href='#'
                                        className='hover:text-white'
                                    >
                                        Terms of service
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href='#'
                                        className='hover:text-white'
                                    >
                                        Privacy policy
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href='#'
                                        className='hover:text-white'
                                    >
                                        Community
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className='pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500'>
                        <p>© 2024 Grounds.ph - All rights reserved.</p>
                        <p>Made with ☕ in Cebu, Philippines.</p>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default App
