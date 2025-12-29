# Storage Module

Provider-agnostic storage utilities for the Grounds website. Supports both Supabase Storage and Cloudflare R2.

## Quick Start

```typescript
import {
    getStorageProvider,
    STORAGE_BUCKETS,
    validateFile,
} from "@/utils/storage"

// Get the configured storage provider
const storage = await getStorageProvider()

// Validate a file before upload
const validation = validateFile(file, STORAGE_BUCKETS.CAFES)
if (!validation.valid) {
    console.error(validation.error)
    return
}

// Upload a file
const result = await storage.upload(
    STORAGE_BUCKETS.CAFES,
    `${userId}/${timestamp}-${random}.jpg`,
    file
)

if (result.success) {
    console.log("File URL:", result.url)
}
```

## Configuration

Set the `STORAGE_PROVIDER` environment variable to switch providers:

```bash
# Use Supabase Storage (default)
STORAGE_PROVIDER=supabase

# Use Cloudflare R2
STORAGE_PROVIDER=cloudflare-r2
```

### Cloudflare R2 Configuration

When using R2, add these environment variables:

```bash
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://cdn.yourdomain.com
```

## Storage Buckets

| Bucket             | Purpose                   | Max Size | Public |
| ------------------ | ------------------------- | -------- | ------ |
| `cafes`            | Cafe thumbnails & gallery | 5MB      | ✅     |
| `reviews`          | User review images        | 5MB      | ✅     |
| `avatars`          | User profile pictures     | 2MB      | ✅     |
| `blogs`            | Blog post covers          | 5MB      | ✅     |
| `events`           | Event covers              | 5MB      | ✅     |
| `menu-photos`      | Menu item photos          | 5MB      | ✅     |
| `badges`           | Badge images              | 500KB    | ✅     |
| `ownership-proofs` | Claim documents           | 10MB     | ❌     |

## API Reference

### `getStorageProvider()`

Returns the configured storage provider instance.

### `StorageProvider` Interface

- `upload(bucket, path, file, options?)` - Upload a file
- `delete(bucket, paths)` - Delete files
- `getPublicUrl(bucket, path)` - Get public URL
- `createSignedUrl(bucket, path, expiresIn)` - Create temporary signed URL
- `list(bucket, options?)` - List files in bucket
- `extractPathFromUrl(url, bucket)` - Extract path from full URL

### Helper Functions

- `validateFile(file, bucket)` - Validate file against bucket config
- `generateFilePath(userId, fileName)` - Generate unique user-scoped path
- `generateCafeFilePath(cafeId, fileName)` - Generate cafe-scoped path
- `generateRootFilePath(fileName)` - Generate root-level path
- `addCacheBuster(url)` - Add cache-busting query param
- `stripQueryParams(url)` - Remove query params from URL
