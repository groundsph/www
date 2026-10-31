import { describe, it, expect, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

const downloadAllImagesSpy = mock(() => Promise.resolve())

mock.module("@/components/layout/NotificationProvider", () => ({
    useNotification: () => ({ addNotification: mock() }),
}))
mock.module("@/hooks/useConfirm", () => ({
    useConfirm: () => ({ confirm: () => Promise.resolve(true), dialog: null }),
}))
mock.module("@/utils/hooks/useImageUploadQueue", () => ({
    useImageUploadQueue: () => ({
        items: [],
        isBusy: false,
        enqueue: mock(),
        retry: mock(),
        dismiss: mock(),
    }),
}))
mock.module("@/utils/hooks/useCoverImageUpload", () => ({
    useCoverImageUpload: () => ({
        uploading: false,
        cropperOpen: false,
        croppingImage: null,
        handleFileChange: mock(),
        handleCropComplete: mock(),
        closeCropper: mock(),
    }),
}))
mock.module("@/utils/storage/client", () => ({
    uploadCafeBadgeStamp: mock(),
}))
mock.module("@/components/ui/ImageCropper", () => ({
    default: () => null,
}))
mock.module("@/utils/image-download", () => ({
    downloadAllImages: downloadAllImagesSpy,
    downloadImage: mock(() => Promise.resolve()),
}))

import ImageSection from "@/components/cafe-editor/ImageSection"

const THUMBNAIL = "https://cdn.grounds.ph/cafes/cover.jpg"
const GALLERY = [
    "https://cdn.grounds.ph/cafes/one.jpg",
    "https://cdn.grounds.ph/cafes/two.jpg",
]

function renderSection(props: {
    thumbnail: string | null
    gallery: string[]
    cafeName?: string
}) {
    return render(
        <ImageSection
            thumbnail={props.thumbnail}
            gallery={props.gallery}
            cafeId='cafe1'
            cafeName={props.cafeName ?? "Moni Cafe"}
            onThumbnailChange={mock()}
            onGalleryChange={mock()}
            onDeleteImage={mock(() => Promise.resolve())}
        />
    )
}

describe("ImageSection — download all images", () => {
    it("lives inside the Images tab next to the gallery upload control", () => {
        const { getByRole } = renderSection({
            thumbnail: THUMBNAIL,
            gallery: GALLERY,
        })

        const button = getByRole("button", { name: /Download all images/i })
        expect(button).toBeTruthy()
        // Secondary action styling, not the old blue primary button.
        expect(button.className).toContain("border-text/10")
        expect(button.className).not.toContain("bg-blue-500")
    })

    it("downloads the cover and every gallery image at 1920px", async () => {
        downloadAllImagesSpy.mockClear()

        const { getByRole } = renderSection({
            thumbnail: THUMBNAIL,
            gallery: GALLERY,
        })

        fireEvent.click(getByRole("button", { name: /Download all images/i }))

        await waitFor(() => expect(downloadAllImagesSpy).toHaveBeenCalledTimes(1))
        const [images] = downloadAllImagesSpy.mock.calls[0] as [
            { url: string; filename: string }[],
        ]

        expect(images).toHaveLength(3)
        expect(images[0].filename).toBe("Moni Cafe-thumbnail.webp")
        expect(images[1].filename).toBe("Moni Cafe-gallery-1.webp")
        expect(images[2].filename).toBe("Moni Cafe-gallery-2.webp")
        for (const image of images) {
            expect(image.url).toContain("width=1920")
        }
    })

    it("is disabled when the cafe has no images", () => {
        const { getByRole } = renderSection({ thumbnail: null, gallery: [] })

        const button = getByRole("button", {
            name: /Download all images/i,
        }) as HTMLButtonElement
        expect(button.disabled).toBe(true)
    })
})
