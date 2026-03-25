"use client"

import { useState, useCallback } from "react"
import { Lock, Globe, Loader2 } from "lucide-react"

interface PrivacySettingsProps {
    initialIsPrivate: boolean
}

export default function PrivacySettings({ initialIsPrivate }: PrivacySettingsProps) {
    const [isPrivate, setIsPrivate] = useState(initialIsPrivate)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleToggle = useCallback(async (newValue: boolean) => {
        setIsLoading(true)
        setError(null)
        try {
            const { updatePrivacySettings } = await import("@/app/api/actions/profile")
            const result = await updatePrivacySettings(newValue)
            if (result.success) {
                setIsPrivate(newValue)
            } else {
                setError(result.error || "Failed to update privacy settings")
            }
        } catch {
            setError("An unexpected error occurred")
        } finally {
            setIsLoading(false)
        }
    }, [])

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text">Profile Privacy</h3>
            
            <div className="flex flex-col gap-3">
                {/* Public Option */}
                <button
                    onClick={() => !isPrivate || isLoading ? null : handleToggle(false)}
                    disabled={isLoading}
                    className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${
                        !isPrivate 
                            ? "border-primary bg-primary/5 ring-1 ring-primary" 
                            : "border-border hover:border-primary/50"
                    }`}
                >
                    <div className={`mt-0.5 ${!isPrivate ? "text-primary" : "text-text-muted"}`}>
                        <Globe className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-medium text-text">Public Profile</div>
                        <div className="text-sm text-text-muted mt-0.5">
                            Anyone can see your profile, reviews, and check-ins
                        </div>
                    </div>
                    {!isPrivate && (
                        <div className="text-primary">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </button>

                {/* Private Option */}
                <button
                    onClick={() => isPrivate || isLoading ? null : handleToggle(true)}
                    disabled={isLoading}
                    className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${
                        isPrivate 
                            ? "border-primary bg-primary/5 ring-1 ring-primary" 
                            : "border-border hover:border-primary/50"
                    }`}
                >
                    <div className={`mt-0.5 ${isPrivate ? "text-primary" : "text-text-muted"}`}>
                        <Lock className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-medium text-text">Private Profile</div>
                        <div className="text-sm text-text-muted mt-0.5">
                            Only approved followers can see your reviews and check-ins
                        </div>
                    </div>
                    {isPrivate && (
                        <div className="text-primary">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </button>
            </div>

            {isLoading && (
                <div className="flex items-center gap-2 text-sm text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                </div>
            )}

            {error && (
                <div className="text-sm text-red-500">{error}</div>
            )}

            {isPrivate && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-sm text-amber-600">
                        <strong>Note:</strong> Your existing followers will continue to see your content. 
                        New followers will need your approval.
                    </p>
                </div>
            )}
        </div>
    )
}
