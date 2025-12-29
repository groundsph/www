"use client"

/**
 * MenuItemModal - Shared component for adding/editing cafe menu items.
 * Used by CafeEditor (admin) and CafeManagementClient (owner).
 */

import { useState, useEffect, useRef } from "react"
import { Loader2, ImagePlus, X } from "lucide-react"
import Image from "next/image"
import imageCompression from "browser-image-compression"
import ImageCropper from "@/components/ui/ImageCropper"
import { type ColorScheme, getColorClasses } from "@/utils/hooks/cafe-form"
import {
    MENU_CATEGORIES,
    type MenuItemForm,
    type CafeMenuItem,
} from "@/utils/types/owner"
import { uploadMenuPhoto } from "@/utils/supabase/storage"

interface MenuItemModalProps {
    /** Whether the modal is open */
    open: boolean
    /** Close the modal */
    onClose: () => void
    /** Save the menu item (returns success) */
    onSave: (data: MenuItemForm) => Promise<boolean>
    /** Existing menu item (for editing) */
    editingItem?: CafeMenuItem | null
    /** Whether save is in progress */
    saving?: boolean
    /** Color scheme for theming */
    colorScheme?: ColorScheme
    /** Cafe ID for image uploads */
    cafeId?: string
}

const DEFAULT_FORM: MenuItemForm = {
    category: "Coffee",
    name: "",
    description: "",
    price: 0,
    is_signature: false,
    is_available: true,
}

/**
 * Modal for creating or editing cafe menu items.
 * Includes name, category, price, description, image, and flags for signature/available.
 */
export default function MenuItemModal({
    open,
    onClose,
    onSave,
    editingItem,
    saving = false,
    colorScheme = "primary",
    cafeId,
}: MenuItemModalProps) {
    const colors = getColorClasses(colorScheme)
    const [form, setForm] = useState<MenuItemForm>(DEFAULT_FORM)
    const [uploadProgress, setUploadProgress] = useState<number | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [cropperImage, setCropperImage] = useState<File | null>(null)
    const [showCropper, setShowCropper] = useState(false)
    // Pending image: stores compressed blob + preview URL before upload
    const [pendingImage, setPendingImage] = useState<{
        blob: Blob
        previewUrl: string
    } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Reset form when modal opens or editing item changes
    useEffect(() => {
        if (open) {
            if (editingItem) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setForm({
                    category: editingItem.category,
                    name: editingItem.name,
                    description: editingItem.description || "",
                    price: editingItem.price,
                    image_url: editingItem.image_url || undefined,
                    is_signature: editingItem.is_signature,
                    is_available: editingItem.is_available,
                })
            } else {
                setForm(DEFAULT_FORM)
            }
            setUploadProgress(null)
            setUploadError(null)
            setCropperImage(null)
            setShowCropper(false)
            // Cleanup pending image preview URL
            if (pendingImage?.previewUrl) {
                URL.revokeObjectURL(pendingImage.previewUrl)
            }
            setPendingImage(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editingItem])

    // Cleanup preview URL on unmount
    useEffect(() => {
        return () => {
            if (pendingImage?.previewUrl) {
                URL.revokeObjectURL(pendingImage.previewUrl)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Step 1: When user selects file, open cropper
    const handleImageSelect = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0]
        if (!file || !cafeId) return

        setCropperImage(file)
        setShowCropper(true)
        setUploadError(null)

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    // Step 2: After cropping, compress and store (don't upload yet)
    const handleCropComplete = async (croppedBlob: Blob) => {
        setShowCropper(false)
        setCropperImage(null)

        try {
            // Convert blob to file for compression
            const croppedFile = new File([croppedBlob], "menu-photo.webp", {
                type: "image/webp",
            })

            // Compress to max 800x800 and ~150KB
            const compressedBlob = await imageCompression(croppedFile, {
                maxSizeMB: 0.15, // ~150KB
                maxWidthOrHeight: 800,
                useWebWorker: true,
                fileType: "image/webp",
            })

            // Store blob and create preview URL
            const previewUrl = URL.createObjectURL(compressedBlob)
            setPendingImage({ blob: compressedBlob, previewUrl })
            // Clear any existing image_url since we have a new pending image
            setForm({ ...form, image_url: undefined })
        } catch {
            setUploadError("Failed to process image")
        }
    }

    const handleCropCancel = () => {
        setShowCropper(false)
        setCropperImage(null)
    }

    const handleRemoveImage = () => {
        if (pendingImage?.previewUrl) {
            URL.revokeObjectURL(pendingImage.previewUrl)
        }
        setPendingImage(null)
        setForm({ ...form, image_url: undefined })
    }

    const handleSubmit = async () => {
        if (!form.name.trim()) return

        let imageUrl = form.image_url

        // Upload pending image if exists
        if (pendingImage && cafeId) {
            setUploadProgress(0)
            try {
                const formData = new FormData()
                formData.append("image", pendingImage.blob)
                formData.append("cafeId", cafeId)

                setUploadProgress(50)
                const result = await uploadMenuPhoto(formData)

                if (result.success && result.url) {
                    imageUrl = result.url
                    setUploadProgress(100)
                } else {
                    setUploadError(result.error || "Upload failed")
                    setUploadProgress(null)
                    return // Don't proceed with save if upload failed
                }
            } catch {
                setUploadError("Failed to upload image")
                setUploadProgress(null)
                return
            }
        }

        const success = await onSave({ ...form, image_url: imageUrl })
        if (success) {
            setUploadProgress(null)
            onClose()
        }
    }

    // Get the image to display (pending preview or existing URL)
    const displayImageUrl = pendingImage?.previewUrl || form.image_url

    if (!open) return null

    return (
        <>
            <div
                className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
                onClick={onClose}
            >
                <div
                    className='bg-background rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto'
                    onClick={(e) => e.stopPropagation()}
                >
                    <h2 className='text-xl font-semibold mb-4'>
                        {editingItem ? "Edit Menu Item" : "Add Menu Item"}
                    </h2>

                    <div className='space-y-4'>
                        {/* Image Upload */}
                        {cafeId && (
                            <div>
                                <label className='block text-sm font-medium mb-2'>
                                    Photo
                                </label>
                                {displayImageUrl ? (
                                    <div className='flex items-center justify-center w-full'>
                                        <div className='relative h-42 aspect-square rounded-lg overflow-hidden bg-text/5'>
                                            <Image
                                                src={displayImageUrl}
                                                alt='Menu item'
                                                fill
                                                className='object-cover'
                                            />
                                            <button
                                                type='button'
                                                onClick={handleRemoveImage}
                                                className='absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors'
                                            >
                                                <X className='w-4 h-4' />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        className={`w-full h-32 border-2 border-dashed border-text/20 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-text/40 transition-colors ${
                                            uploadProgress !== null
                                                ? "opacity-50 pointer-events-none"
                                                : ""
                                        }`}
                                    >
                                        {uploadProgress !== null ? (
                                            <>
                                                <Loader2 className='w-6 h-6 animate-spin text-text/40' />
                                                <span className='text-sm text-text/60'>
                                                    Uploading...{" "}
                                                    {Math.round(uploadProgress)}
                                                    %
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <ImagePlus className='w-6 h-6 text-text/40' />
                                                <span className='text-sm text-text/60'>
                                                    Click to add photo
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type='file'
                                    accept='image/jpeg,image/png,image/webp,image/gif'
                                    onChange={handleImageSelect}
                                    className='hidden'
                                />
                                {uploadError && (
                                    <p className='text-sm text-red-500 mt-1'>
                                        {uploadError}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Name */}
                        <div>
                            <label className='block text-sm font-medium mb-1'>
                                Name *
                            </label>
                            <input
                                type='text'
                                value={form.name}
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                                className={`w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`}
                                placeholder='e.g., Iced Latte'
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className='block text-sm font-medium mb-1'>
                                Category
                            </label>
                            <select
                                value={form.category}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        category: e.target.value,
                                    })
                                }
                                className={`w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`}
                            >
                                {MENU_CATEGORIES.map((category) => (
                                    <option
                                        key={category}
                                        value={category}
                                    >
                                        {category}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Price */}
                        <div>
                            <label className='block text-sm font-medium mb-1'>
                                Price (₱)
                            </label>
                            <input
                                type='number'
                                min='0'
                                step='0.01'
                                value={form.price || ""}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        price: parseFloat(e.target.value) || 0,
                                    })
                                }
                                className={`w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`}
                                placeholder='0'
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className='block text-sm font-medium mb-1'>
                                Description
                            </label>
                            <textarea
                                value={form.description || ""}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        description: e.target.value,
                                    })
                                }
                                rows={2}
                                className={`w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg resize-none focus:outline-none focus:ring-2 ${colors.focusRing}`}
                                placeholder='Optional description...'
                            />
                        </div>

                        {/* Flags */}
                        <div className='flex gap-4'>
                            <label className='flex items-center gap-2 cursor-pointer'>
                                <input
                                    type='checkbox'
                                    checked={form.is_signature || false}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            is_signature: e.target.checked,
                                        })
                                    }
                                    className={`rounded border-text/20 ${colors.text}`}
                                />
                                <span className='text-sm'>Signature</span>
                            </label>
                            <label className='flex items-center gap-2 cursor-pointer'>
                                <input
                                    type='checkbox'
                                    checked={form.is_available ?? true}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            is_available: e.target.checked,
                                        })
                                    }
                                    className={`rounded border-text/20 ${colors.text}`}
                                />
                                <span className='text-sm'>Available</span>
                            </label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className='flex gap-3 mt-6'>
                        <button
                            type='button'
                            onClick={onClose}
                            className='flex-1 px-4 py-2 bg-text/10 rounded-lg font-medium hover:bg-text/20 transition'
                        >
                            Cancel
                        </button>
                        <button
                            type='button'
                            onClick={handleSubmit}
                            disabled={
                                saving ||
                                !form.name.trim() ||
                                uploadProgress !== null
                            }
                            className={`flex-1 px-4 py-2 ${colors.bg} text-white rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition flex items-center justify-center gap-2`}
                        >
                            {saving && (
                                <Loader2 className='w-4 h-4 animate-spin' />
                            )}
                            {saving
                                ? "Saving..."
                                : editingItem
                                  ? "Save"
                                  : "Add"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Image Cropper Modal */}
            <ImageCropper
                open={showCropper}
                image={cropperImage}
                aspect={1}
                onComplete={handleCropComplete}
                onCancel={handleCropCancel}
            />
        </>
    )
}
