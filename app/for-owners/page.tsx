import { Metadata } from "next"
import OwnerBenefits from "@/components/owner/OwnerBenefits"
import { FAQ_ITEMS } from "@/components/owner/owner-benefits-content"
import { buildBreadcrumbList } from "@/utils/seo/breadcrumbs"

// ROUTE SAFETY — do not rename or move this route.
// `proxy.ts` treats every path starting with "/owner" as protected,
// `app/robots.ts` disallows "/owner/", and `components/chat/ChatWidget.tsx`
// hides the chat widget on any path containing "/owner". Keeping the
// marketing route at "/for-owners" avoids all three.

export const metadata: Metadata = {
    title: "Cafe Owner Benefits",
    description:
        "Claim your cafe on Grounds for free. Edit your listing, build a menu, run discount vouchers, reply to reviews and see your page analytics — with no subscription and no commission.",
    keywords: [
        "claim cafe listing",
        "cafe owner Philippines",
        "add my cafe to Grounds",
        "free cafe listing",
        "cafe management tools",
        "cafe discounts Philippines",
    ],
    alternates: {
        canonical: "/for-owners",
    },
    openGraph: {
        title: "Cafe Owner Benefits | Grounds",
        description:
            "Everything a cafe owner gets on Grounds: a listing you control, a real menu, discount vouchers, review replies and page analytics. Free to claim, free to manage.",
        type: "website",
    },
    twitter: {
        card: "summary",
        title: "Cafe Owner Benefits | Grounds",
        description:
            "Claim your cafe on Grounds for free. No subscription, no commission, no card.",
    },
}

export default function ForOwnersPage() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://grounds.ph"

    const breadcrumbs = buildBreadcrumbList([
        { name: "GroundsPH", url: siteUrl },
        { name: "For Cafe Owners", url: `${siteUrl}/for-owners` },
    ])

    const faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
            },
        })),
    }

    return (
        <>
            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(breadcrumbs),
                }}
            />
            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(faqJsonLd),
                }}
            />
            <OwnerBenefits />
        </>
    )
}
