"use client"

import { useState, useEffect } from "react"
import { getChatEnabledFlag, setChatEnabled } from "@/app/api/actions/admin/feature-flags"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

export function ChatSettings() {
    const [enabled, setEnabled] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        async function loadSetting() {
            const result = await getChatEnabledFlag()
            if (result.success && result.enabled !== undefined) {
                setEnabled(result.enabled)
            }
            setLoading(false)
        }
        loadSetting()
    }, [])

    async function handleToggle() {
        setSaving(true)
        setMessage(null)

        const newValue = !enabled
        const result = await setChatEnabled(newValue)

        if (result.success) {
            setEnabled(newValue)
            setMessage({ type: 'success', text: `Chat ${newValue ? 'enabled' : 'disabled'} successfully` })
        } else {
            setMessage({ type: 'error', text: result.error || "Failed to update setting" })
        }

        setSaving(false)

        // Clear message after 3 seconds
        setTimeout(() => setMessage(null), 3000)
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 p-4" data-testid="loading">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm text-text/60">Loading...</span>
            </div>
        )
    }

    return (
        <div className="space-y-4 p-4">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h3 className="text-sm font-medium text-text">Chat Feature</h3>
                    <p className="text-xs text-text/60">Enable or disable the AI chat feature for all users</p>
                </div>
                
                <button
                    type="button"
                    role="checkbox"
                    aria-checked={enabled}
                    onClick={handleToggle}
                    disabled={saving}
                    className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                        ${enabled ? 'bg-primary' : 'bg-text/20'}
                        ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                >
                    <span
                        className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${enabled ? 'translate-x-6' : 'translate-x-1'}
                        `}
                    />
                </button>
            </div>

            {message && (
                <div
                    className={`
                        flex items-center gap-2 text-sm p-3 rounded-lg
                        ${message.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}
                    `}
                    role="alert"
                >
                    {message.type === 'success' ? (
                        <>
                            <CheckCircle className="w-4 h-4" />
                            {message.text}
                        </>
                    ) : (
                        <>
                            <XCircle className="w-4 h-4" />
                            {message.text}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
