"use client"

import { AuthContext } from "@/components/AuthProvider"
import { useContext } from "react"

export default function SubmitPageClient() {
    // Context - auth is handled by middleware
    const { profile } = useContext(AuthContext)

    // Render
    return (
        <main className='w-full min-h-screen flex flex-col items-center px-4 py-12'>
            <div className='w-full max-w-2xl'>
                <h1 className='text-3xl md:text-4xl font-bold font-serif mb-6'>
                    Submit a Cafe
                </h1>
                <p className='text-text/70 mb-8'>
                    Welcome,{" "}
                    {profile?.display_name || profile?.username || "user"}! Help
                    us grow by submitting a new cafe.
                </p>
                {/* TODO: Add submit form here */}
                <div className='bg-secondary/10 border border-secondary/20 rounded-xl p-8 text-center'>
                    <p className='text-text/60'>Submit form coming soon...</p>
                </div>
            </div>
        </main>
    )
}
