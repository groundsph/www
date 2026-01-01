import { Metadata } from "next"
import {
    Coffee,
    Rocket,
    Lightbulb,
    CheckCircle2,
    Clock,
    Star,
    Share2,
    Palette,
    Navigation,
    ArrowUpCircle,
    Zap,
    Key,
    Search,
} from "lucide-react"

export const metadata: Metadata = {
    title: "Roadmap - What We're Building Next",
    description:
        "See what's coming to Grounds. Our public roadmap shows features in progress like enhanced search and decaf filters, upcoming auth improvements, and future plans like a mobile app and dark mode.",
    keywords: [
        "Grounds roadmap",
        "cafe app features",
        "upcoming features",
        "product roadmap",
        "Grounds updates",
        "cafe finder features",
    ],
    openGraph: {
        title: "Roadmap - What We're Building Next | Grounds",
        description:
            "See what's coming to Grounds. Explore features we're building, what's up next, and ideas we're exploring for the future of cafe discovery.",
        type: "website",
    },
    twitter: {
        card: "summary",
        title: "Roadmap | Grounds",
        description:
            "See what's coming to Grounds — enhanced search, passkey support, hidden cafes, and more.",
    },
}

interface RoadmapItem {
    title: string
    description: string
    icon: React.ReactNode
}

const recentlyShipped: RoadmapItem[] = [
    {
        title: "Smart Login & Security",
        description:
            "Seamless sign-in with Passkeys, plus social login via Discord and Google.",
        icon: <Key className='w-5 h-5' />,
    },
    {
        title: "Cafe Discovery Tools",
        description:
            "Find your perfect spot with new Decaf, 3rd Wave, and Vibe-based filters.",
        icon: <Search className='w-5 h-5' />,
    },
    {
        title: "Hidden Gems",
        description:
            "Discover and share those special 'low-key' spots that deserve more love.",
        icon: <Star className='w-5 h-5' />,
    },
    {
        title: "Enhanced Menus",
        description:
            "Visual menus with photos to help you decide before you arrive.",
        icon: <Navigation className='w-5 h-5' />,
    },
    {
        title: "Performance Upgrades",
        description:
            "Faster load times and snappier interactions across the entire site.",
        icon: <Zap className='w-5 h-5' />,
    },
    {
        title: "User Collections",
        description:
            "Save and organize your favorite cafes into shareable lists",
        icon: <Star className='w-5 h-5' />,
    },
]

const inProgress: RoadmapItem[] = [
    {
        title: "Continued Cafe Additions",
        description:
            "Expanding our database with more cafes across the Philippines",
        icon: <Coffee className='w-5 h-5' />,
    },
]

const upNext: RoadmapItem[] = [
    {
        title: "Spot Guides",
        description:
            "Visual step-by-step guides using photos or videos to help you navigate to hard-to-find cafes",
        icon: <Navigation className='w-5 h-5' />,
    },
]

const exploring: RoadmapItem[] = [
    {
        title: "Mobile App",
        description:
            "A dedicated mobile app for iOS and Android with offline access",
        icon: <Rocket className='w-5 h-5' />,
    },
    {
        title: "Proper Social Sharing",
        description:
            "Rich previews when sharing cafes on social media with custom graphics",
        icon: <Share2 className='w-5 h-5' />,
    },
    {
        title: "Personalized Recommendations",
        description:
            "Cafe suggestions based on your preferences and visit history",
        icon: <Lightbulb className='w-5 h-5' />,
    },
    {
        title: "Dark Mode",
        description:
            "A sleek dark theme for night owls and low-light environments",
        icon: <Palette className='w-5 h-5' />,
    },
]

function RoadmapSection({
    title,
    items,
    icon: Icon,
    accentColor,
}: {
    title: string
    items: RoadmapItem[]
    icon: React.ReactNode
    accentColor: string
}) {
    return (
        <div className='flex flex-col gap-6'>
            <div className='flex items-center gap-3'>
                <div className={`p-2 rounded-xl ${accentColor}`}>{Icon}</div>
                <h2 className='text-2xl font-bold font-serif text-text'>
                    {title}
                </h2>
            </div>
            <div className='grid gap-4'>
                {items.map((item) => (
                    <div
                        key={item.title}
                        className='p-5 bg-text/5 border border-text/10 rounded-xl hover:border-text/20 transition-colors'
                    >
                        <div className='flex items-start gap-4'>
                            <div className='p-2 bg-background rounded-lg text-primary shrink-0'>
                                {item.icon}
                            </div>
                            <div className='flex flex-col gap-1'>
                                <h3 className='font-semibold text-text text-lg'>
                                    {item.title}
                                </h3>
                                <p className='text-text/60 text-sm leading-relaxed'>
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function RoadmapPage() {
    return (
        <main className='w-full min-h-screen bg-background'>
            {/* Hero Section */}
            <section className='relative bg-linear-to-br from-primary/10 via-secondary/5 to-tertiary/10 py-20 overflow-hidden'>
                {/* Decorative Background Elements */}
                <div className='absolute inset-0 pointer-events-none select-none overflow-hidden'>
                    <Rocket className='absolute -top-6 -right-6 w-48 h-48 text-primary/5 rotate-12' />
                    <Lightbulb className='absolute -bottom-12 -left-12 w-64 h-64 text-secondary/5 -rotate-12' />
                    <div className='absolute top-1/4 right-1/4 w-32 h-32 bg-accent/5 rounded-full blur-3xl' />
                    <div className='absolute bottom-1/4 left-1/3 w-40 h-40 bg-primary/5 rounded-full blur-3xl' />
                    <Coffee className='absolute top-20 right-[20%] w-16 h-16 text-text/5 rotate-12' />
                </div>

                <div className='max-w-7xl mx-auto px-4 relative z-10'>
                    <span className='inline-block px-3 py-1 mb-4 bg-background/50 backdrop-blur-sm border border-text/5 rounded-full text-xs font-medium text-text/60 uppercase tracking-wider'>
                        Product Roadmap
                    </span>
                    <h1 className='text-5xl md:text-6xl lg:text-7xl font-bold font-serif text-text mb-6 tracking-tight'>
                        What{"'"}s Next
                    </h1>
                    <p className='text-xl md:text-2xl text-text/70 max-w-2xl font-light leading-relaxed'>
                        A glimpse into what we{"'"}re building. Have a feature
                        request?{" "}
                        <a
                            href='/contact'
                            className='text-primary hover:underline'
                        >
                            Let us know
                        </a>
                        .
                    </p>
                </div>
            </section>

            {/* Roadmap Content */}
            <div className='max-w-4xl mx-auto px-4 py-16'>
                <div className='flex flex-col gap-16'>
                    {/* Recently Shipped */}
                    <RoadmapSection
                        title='Recently Shipped'
                        items={recentlyShipped}
                        icon={
                            <CheckCircle2 className='w-5 h-5 text-emerald-600' />
                        }
                        accentColor='bg-emerald-100'
                    />

                    {/* In Progress */}
                    <RoadmapSection
                        title='In Progress'
                        items={inProgress}
                        icon={<Clock className='w-5 h-5 text-amber-600' />}
                        accentColor='bg-amber-100'
                    />

                    {/* Up Next */}
                    <RoadmapSection
                        title='Up Next'
                        items={upNext}
                        icon={
                            <ArrowUpCircle className='w-5 h-5 text-blue-600' />
                        }
                        accentColor='bg-blue-100'
                    />

                    {/* Exploring */}
                    <RoadmapSection
                        title='Exploring'
                        items={exploring}
                        icon={<Lightbulb className='w-5 h-5 text-violet-600' />}
                        accentColor='bg-violet-100'
                    />
                </div>

                {/* Footer Note */}
                <div className='mt-16 pt-8 border-t border-text/10 text-center'>
                    <p className='text-text/50 text-sm'>
                        Last updated: January 2026. Roadmap items are subject to
                        change.
                    </p>
                </div>
            </div>
        </main>
    )
}
