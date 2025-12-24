import { Metadata } from "next"
import ContactPageClient from "./ContactPageClient"

export const metadata: Metadata = {
    title: "Contact Us",
    description: "Get in touch with the Grounds team",
}

export default function ContactPage() {
    return <ContactPageClient />
}
