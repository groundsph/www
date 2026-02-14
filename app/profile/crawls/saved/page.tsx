import { Metadata } from "next"
import { getSavedCafeCrawls } from "@/app/api/actions/cafe-crawls"
import SavedCrawlsList from "@/components/crawls/SavedCrawlsList"

export const metadata: Metadata = {
    title: "Saved Crawls",
    description: "View your saved cafe crawls",
}

export default async function SavedCrawlsPage() {
    const crawls = await getSavedCafeCrawls()
    return <SavedCrawlsList crawls={crawls} />
}
