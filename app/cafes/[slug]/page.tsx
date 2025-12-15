import CafeDetails from "@/components/CafeDetails"
import { createClient } from "@/utils/supabase/server"
import Link from "next/link"
import type { Metadata } from "next"
import { dummyCafes } from "@/utils/dummy/cafes"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>
}): Promise<Metadata> {
    const db = await createClient()
    const { slug } = await params
    // const cafe = (await db.from("cafes").select("*").eq("slug", slug).single()).data
    const cafe = dummyCafes.find((cafe) => cafe.slug === slug)

    if (!cafe) {
        return {
            title: "Cafe Not Found",
            description: "The cafe you are looking for does not exist.",
        }
    }

    const { name, description, address_display, thumbnail } = cafe

    return {
        title: `${name}`,
        description:
            description ||
            `Visit ${name} at ${address_display}. Find the perfect spot for your next coffee break or work session.`,
        openGraph: {
            title: `${name}`,
            description:
                description ||
                `Visit ${name} at ${address_display}. Find the perfect spot for your next coffee break or work session.`,
            type: "website",
            images: thumbnail ? [{ url: thumbnail }] : undefined,
        },
    }
}

export default async function CafePage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    // Constants
    const db = await createClient()
    const { slug } = await params
    // const cafe = (await db.from("cafes").select("*").eq("slug", slug).single()).data
    const cafe = dummyCafes.find((cafe) => cafe.slug === slug)
    if (!cafe)
        return (
            <section
                id='not-found'
                className='w-full h-full flex flex-col items-center justify-center flex-1'
            >
                <h1 className='text-5xl font-bold'>404</h1>
                <p className='text-2xl font-semibold'>Page Not Found</p>
                <p className='text-xl'>
                    The page you are looking for does not exist.
                </p>
                <Link
                    href='/'
                    className='text-sm font-semibold underline transition-colors hover:text-text/60'
                >
                    Go Back Home
                </Link>
            </section>
        )

    // Pass cafe slug to client component
    return <CafeDetails cafe={cafe} />
}
