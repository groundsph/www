import { Metadata } from "next"
import SubmitPageClient from "./SubmitPageClient"

export const metadata: Metadata = {
    title: "Submit",
    description: "Submit a new cafe to Grounds",
}

export default function SubmitPage() {
    return <SubmitPageClient />
}
