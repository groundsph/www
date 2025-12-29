import { Metadata } from "next"
import ClaimSupporterClient from "./ClaimSupporterClient"

export const metadata: Metadata = {
    title: "Claim Supporter Badge | Grounds",
    description:
        "Link your Ko-fi donation to receive your Grounds Supporter badge",
}

export default function ClaimSupporterPage() {
    return <ClaimSupporterClient />
}
