import { Metadata } from "next"
import { Suspense } from "react"
import AuthPageComponent from "@/components/auth/AuthPage"

export const metadata: Metadata = {
    title: "Auth",
    description: "Sign in or create your Grounds account",
}

export default function AuthPage() {
    return (
        <Suspense fallback={<AuthLoading />}>
            <AuthPageComponent />
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
