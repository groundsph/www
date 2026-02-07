"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { createCollection } from "@/app/api/actions/collection"
import { useNotification } from "@/components/layout/NotificationProvider"

interface CreateCollectionModalProps {
    onClose: () => void
    onCreated: (collection: { id: string; slug: string }) => void
}

export default function CreateCollectionModal({
    onClose,
    onCreated,
}: CreateCollectionModalProps) {
    const { addNotification } = useNotification()
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [isPublic, setIsPublic] = useState(true)
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) {
            addNotification("Title is required", "error")
            return
        }

        setIsLoading(true)

        try {
            const result = await createCollection({
                title: title.trim(),
                description: description.trim() || undefined,
                isPublic,
            })
            addNotification("Collection created!", "success")
            onCreated(result)
        } catch (err) {
            console.error(err)
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "Failed to create collection"
            addNotification(errorMessage, "error")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            {/* Backdrop */}
            <div
                className='absolute inset-0 bg-black/5 backdrop-blur-sm'
                onClick={onClose}
            />

            {/* Modal */}
            <div className='relative w-full max-w-md bg-background rounded-2xl shadow-xl overflow-hidden'>
                {/* Header */}
                <div className='flex items-center justify-between px-6 py-4 border-b border-secondary/20'>
                    <h2 className='font-serif text-xl font-semibold text-text'>
                        Create Collection
                    </h2>
                    <button
                        onClick={onClose}
                        className='p-2 -mr-2 text-text/60 hover:text-text transition-colors'
                    >
                        <X className='w-5 h-5' />
                    </button>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleSubmit}
                    className='p-6 space-y-4'
                >
                    {/* Title */}
                    <div>
                        <label className='block text-sm font-medium text-text mb-2'>
                            Title <span className='text-primary'>*</span>
                        </label>
                        <input
                            type='text'
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder='My Favorite Cafes'
                            className='w-full px-4 py-3 bg-background border border-secondary/30 rounded-xl text-text placeholder:text-text/40 focus:outline-none focus:border-primary/50 transition-colors'
                            maxLength={100}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className='block text-sm font-medium text-text mb-2'>
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder='A curated list of my go-to coffee spots...'
                            rows={3}
                            className='w-full px-4 py-3 bg-background border border-secondary/30 rounded-xl text-text placeholder:text-text/40 focus:outline-none focus:border-primary/50 transition-colors resize-none'
                            maxLength={500}
                        />
                    </div>

                    {/* Visibility */}
                    <div className='flex items-center gap-3'>
                        <input
                            type='checkbox'
                            id='isPublic'
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                            className='w-4 h-4 rounded border-secondary/30 text-primary focus:ring-primary/50'
                        />
                        <label
                            htmlFor='isPublic'
                            className='text-sm text-text/80'
                        >
                            Make this collection public
                        </label>
                    </div>

                    {/* Actions */}
                    <div className='flex gap-3 pt-2'>
                        <button
                            type='button'
                            onClick={onClose}
                            className='flex-1 px-4 py-3 text-text/70 font-medium rounded-xl border border-secondary/30 hover:bg-secondary/10 transition-colors'
                        >
                            Cancel
                        </button>
                        <button
                            type='submit'
                            disabled={isLoading || !title.trim()}
                            className='flex-1 px-4 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2'
                        >
                            {isLoading && (
                                <Loader2 className='w-4 h-4 animate-spin' />
                            )}
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
