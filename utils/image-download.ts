export async function downloadImage(url: string, filename: string): Promise<void> {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = blobUrl
    link.download = filename
    link.click()
    URL.revokeObjectURL(blobUrl)
}

export async function downloadAllImages(
    images: { url: string; filename: string }[]
): Promise<void> {
    for (const { url, filename } of images) {
        await downloadImage(url, filename)
    }
}
