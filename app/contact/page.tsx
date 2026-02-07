import { Suspense } from "react"
import { Metadata } from "next"
import ContactPageContent from "@/components/contact/ContactPage"
import Loading from "@/components/Loading"

export const metadata: Metadata = {
    title: "Contact Us",
    description: "Get in touch with the Grounds team",
}

export default function ContactPage() {
    return (
        <Suspense fallback={<Loading />}>
            <ContactPageContent />
        </Suspense>
    )
}
