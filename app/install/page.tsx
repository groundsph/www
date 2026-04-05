import { Metadata } from "next"
import { InstallTutorial } from "@/components/pwa/InstallTutorial"

export const metadata: Metadata = {
    title: "Install Grounds App",
    description: "Add Grounds to your home screen for quick access to the Philippines' best cafes.",
}

export default function InstallPage() {
    return (
        <main className='min-h-screen bg-background'>
            <div className='max-w-lg mx-auto px-4 py-12'>
                <h1 className='text-3xl font-bold mb-2'>Install Grounds</h1>
                <p className='text-text/60 mb-8'>
                    Add Grounds to your home screen for a native app experience — fast loading, offline access, and no browser UI.
                </p>
                <InstallTutorial />
            </div>
        </main>
    )
}
