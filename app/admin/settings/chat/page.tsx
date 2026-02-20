import { ChatSettings } from "@/components/admin/ChatSettings"
import { isAdmin } from "@/app/api/actions/admin"
import { redirect } from "next/navigation"

export default async function ChatSettingsPage() {
    const admin = await isAdmin()
    
    if (!admin) {
        redirect("/")
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-text">Chat Settings</h1>
                    <p className="text-sm text-text/60 mt-1">Manage feature flags for the chat system</p>
                </div>

                <div className="bg-background ring-1 ring-text/10 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-text/10">
                        <h2 className="text-sm font-semibold text-text">Feature Toggles</h2>
                    </div>
                    <ChatSettings />
                </div>
            </div>
        </div>
    )
}
