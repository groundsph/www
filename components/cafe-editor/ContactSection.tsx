"use client"

/**
 * ContactSection - Shared component for cafe contact information editing.
 * Used by CafeEditor (admin) and CafeEditClient (owner).
 */

import { type ColorScheme, getColorClasses } from "@/utils/hooks/cafe-form"
import SocialLinksEditor from "@/components/submit/SocialLinksEditor"
import { CafeSocial } from "@/utils/types/cafe"

export interface ContactData {
    website_url: string | null
    phone: string | null
    email: string | null
    socials: CafeSocial[] | null
}

interface ContactSectionProps {
    /** Current contact data */
    data: ContactData
    /** Update a single field */
    onChange: <K extends keyof ContactData>(
        key: K,
        value: ContactData[K]
    ) => void
    /** Color scheme for theming */
    colorScheme?: ColorScheme
}

/**
 * Contact information section for cafe editing.
 * Includes website, phone, email, and social media links.
 */
export default function ContactSection({
    data,
    onChange,
    colorScheme = "primary",
}: ContactSectionProps) {
    const colors = getColorClasses(colorScheme)

    return (
        <div className='space-y-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                    <label className='block text-sm font-medium text-text/60 mb-2'>
                        Website
                    </label>
                    <input
                        type='url'
                        value={data.website_url || ""}
                        onChange={(e) =>
                            onChange("website_url", e.target.value)
                        }
                        placeholder='https://...'
                        className={`w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`}
                    />
                </div>
                <div>
                    <label className='block text-sm font-medium text-text/60 mb-2'>
                        Phone
                    </label>
                    <input
                        type='tel'
                        value={data.phone || ""}
                        onChange={(e) => onChange("phone", e.target.value)}
                        placeholder='+63...'
                        className={`w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`}
                    />
                </div>
            </div>

            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Email
                </label>
                <input
                    type='email'
                    value={data.email || ""}
                    onChange={(e) => onChange("email", e.target.value)}
                    placeholder='cafe@example.com'
                    className={`w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`}
                />
            </div>

            <div>
                <label className='block text-sm font-medium text-text/60 mb-4'>
                    Social Media Links
                </label>
                <SocialLinksEditor
                    value={data.socials || []}
                    onChange={(socials) => onChange("socials", socials)}
                />
            </div>
        </div>
    )
}
