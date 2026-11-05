"use client"

import { useAuth } from "@/components/layout/AuthProvider"
import CafeSubmissionForm from "@/components/submit/CafeSubmissionForm"
import Link from "next/link"

export default function SubmitPage() {
    // Context - auth is handled by middleware
    const { profile } = useAuth()

    const handleSuccess = (cafeId: string, slug: string) => {
        // Could redirect to the cafe page once approved,
        // but for now just stay on success state
        console.log("Cafe submitted:", cafeId, slug)
    }

    // Render
    return (
        <main className='w-full min-h-screen flex flex-col items-center px-4 py-12'>
            <div className='w-full max-w-3xl'>
                <h1 className='text-3xl md:text-4xl font-bold font-serif mb-2'>
                    Submit a Cafe
                </h1>
                <p className='text-text/70 mb-8'>
                    Welcome,{" "}
                    {profile?.display_name || profile?.username || "Scout"}!
                    Help us grow by submitting a new cafe to the community.
                </p>

                <p className='text-text/70 mb-8 -mt-4'>
                    Already own a cafe that is on Grounds?{" "}
                    <Link
                        href='/for-owners'
                        className='font-medium text-primary hover:underline'
                    >
                        Claim it instead
                    </Link>{" "}
                    — it is free and you keep control of the listing.
                </p>

                <CafeSubmissionForm onSuccess={handleSuccess} />
            </div>
        </main>
    )
}
