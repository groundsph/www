"use client"

import { AuthContext } from "@/components/AuthProvider"
import { useContext } from "react"
import { useRouter } from "next/navigation"
import CafeSubmissionForm from "@/components/submit/CafeSubmissionForm"

export default function SubmitPageClient() {
    const router = useRouter()
    // Context - auth is handled by middleware
    const { profile } = useContext(AuthContext)

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

                <CafeSubmissionForm onSuccess={handleSuccess} />
            </div>
        </main>
    )
}
