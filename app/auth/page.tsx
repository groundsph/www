import { Metadata } from "next"
import { Suspense } from "react"
import { default as AuthPageClient } from "@/components/auth/AuthPage"

export const metadata: Metadata = {
    title: "Auth",
    description: "Sign in or create your Grounds account",
}

export default function AuthPage() {
    return (
        <Suspense fallback={<AuthLoading />}>
            <AuthPageClient />
        </Suspense>
    )
}

function AuthLoading() {
    return (
        <main className='w-full min-h-screen flex items-center justify-center'>
            <div className='text-text/50 font-serif'>Loading...</div>
        </main>
    )
}
