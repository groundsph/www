"use client"

import Link from "next/link"
import { ArrowLeft, Bookmark } from "lucide-react"
import CrawlCard from "./CrawlCard"
import type { CafeCrawlListItem } from "@/app/api/actions/cafe-crawls"

interface UserCrawlsListProps {
    crawls: CafeCrawlListItem[]
}

export default function UserCrawlsList({ crawls }: UserCrawlsListProps) {
    return (
        <div className='min-h-screen w-full bg-background'>
            {/* Header */}
            <div className='border-b w-full border-secondary/20 bg-background/80 backdrop-blur-sm sticky top-0 z-20'>
                <div className='max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4'>
                    <div className='flex items-center gap-4'>
                        <Link
                            href='/profile'
                            className='p-2 -ml-2 text-text/60 hover:text-text transition-colors'
                        >
                            <ArrowLeft className='w-5 h-5' />
                        </Link>
                        <div>
                            <h1 className='font-serif text-2xl font-bold text-text'>
                                My Crawls
                            </h1>
                            <p className='text-sm text-text/60'>
                                {crawls.length} {crawls.length === 1 ? "crawl" : "crawls"} created
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className='max-w-6xl mx-auto px-6 py-8'>
                {crawls.length === 0 ? (
                    <div className='text-center py-16'>
                        <Bookmark className='w-16 h-16 text-secondary opacity-40 mx-auto mb-4' />
                        <h3 className='text-xl font-serif font-semibold text-text mb-2'>
                            No crawls yet
                        </h3>
                        <p className='text-text/60 mb-6'>
                            Create your own cafe crawls and share them with the community.
                        </p>
                        <Link
                            href='/crawls/new'
                            className='inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors'
                        >
                            <Bookmark className='w-5 h-5' />
                            Create Your First Crawl
                        </Link>
                    </div>
                ) : (
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                        {crawls.map((crawl) => (
                            <CrawlCard key={crawl.id} crawl={crawl} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
