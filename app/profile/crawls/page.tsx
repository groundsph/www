import { Metadata } from "next"
import { getUserCafeCrawls } from "@/app/api/actions/cafe-crawls"
import UserCrawlsList from "@/components/crawls/UserCrawlsList"

export const metadata: Metadata = {
    title: "My Crawls",
    description: "View and manage your cafe crawls",
}

export default async function MyCrawlsPage() {
    const crawls = await getUserCafeCrawls()
    return <UserCrawlsList crawls={crawls} />
}
