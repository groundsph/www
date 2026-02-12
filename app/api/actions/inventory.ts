"use server"

import { db } from "@/db"
import { inventoryItems, inventoryRestockHistory } from "@/db/schema/inventory"
import { cafes } from "@/db/schema/tables"
import { eq, desc } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  restockInventoryItemSchema,
  adjustStockSchema,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  RestockInventoryItemInput,
  AdjustStockInput,
} from "@/utils/validation/inventory"
import type { InventoryItem, InventoryRestockHistory, InventoryStats, InventoryFilters } from "@/utils/types/inventory"

// Helper function to check if user owns the cafe
async function checkCafeOwnership(cafeId: string, userId: string): Promise<boolean> {
  const cafe = await db
    .select({ ownerIds: cafes.ownerIds })
    .from(cafes)
    .where(eq(cafes.id, cafeId))
    .limit(1)

  if (cafe.length === 0) {
    return false
  }

  const ownerIds = cafe[0]?.ownerIds || []
  return ownerIds.includes(userId)
}

// Helper function to check if user owns the inventory item
async function checkItemOwnership(itemId: string, userId: string): Promise<boolean> {
  const item = await db
    .select({ cafeId: inventoryItems.cafeId })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, itemId))
    .limit(1)

  if (item.length === 0) {
    return false
  }

  return checkCafeOwnership(item[0]!.cafeId, userId)
}

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Get inventory items for a cafe with optional filters
 */
export async function getInventoryItems(
  cafeId: string,
  filters?: InventoryFilters
): Promise<ActionResult<{ items: InventoryItem[] }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: "Not authenticated" }
  }

  const isOwner = await checkCafeOwnership(cafeId, currentUser.id)
  if (!isOwner) {
    return { success: false, error: "Not authorized" }
  }

  try {
    const items = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.cafeId, cafeId))
      .orderBy(desc(inventoryItems.updatedAt))

    let filteredItems = items

    // Apply filters
    if (filters) {
      // Status filter
      if (filters.status && filters.status !== "all") {
        filteredItems = filteredItems.filter((item) => item.status === filters.status)
      }

      // Category filter
      if (filters.category) {
        filteredItems = filteredItems.filter((item) => item.category === filters.category)
      }

      // Low stock filter
      if (filters.lowStockOnly) {
        filteredItems = filteredItems.filter((item) => item.stock <= item.warningThreshold)
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        filteredItems = filteredItems.filter(
          (item) =>
            item.name.toLowerCase().includes(searchLower) ||
            (item.sku?.toLowerCase().includes(searchLower) ?? false) ||
            item.category.toLowerCase().includes(searchLower)
        )
      }
    }

    const serializedItems: InventoryItem[] = filteredItems.map((item) => ({
      id: item.id,
      cafeId: item.cafeId,
      name: item.name,
      sku: item.sku,
      description: item.description,
      category: item.category,
      stock: item.stock,
      warningThreshold: item.warningThreshold,
      expiryDate: item.expiryDate?.toISOString() ?? null,
      costPrice: item.costPrice,
      lastRestocked: item.lastRestocked?.toISOString() ?? null,
      link: item.link,
      status: item.status ?? "active",
      createdAt: item.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: item.updatedAt?.toISOString() ?? new Date().toISOString(),
    }))

    return { success: true, data: { items: serializedItems } }
  } catch (error) {
    console.error("[getInventoryItems] Error:", error)
    return { success: false, error: "Failed to fetch inventory items" }
  }
}

/**
 * Get inventory statistics for a cafe
 */
export async function getInventoryStats(cafeId: string): Promise<ActionResult<InventoryStats>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: "Not authenticated" }
  }

  const isOwner = await checkCafeOwnership(cafeId, currentUser.id)
  if (!isOwner) {
    return { success: false, error: "Not authorized" }
  }

  try {
    const items = await db
      .select({
        stock: inventoryItems.stock,
        warningThreshold: inventoryItems.warningThreshold,
        costPrice: inventoryItems.costPrice,
        status: inventoryItems.status,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.cafeId, cafeId))

    const totalItems = items.length
    const lowStockCount = items.filter((item) => item.stock <= item.warningThreshold).length
    const valuation = items.reduce((sum, item) => {
      if (item.costPrice && item.status === "active") {
        return sum + item.stock * item.costPrice
      }
      return sum
    }, 0)

    return {
      success: true,
      data: {
        totalItems,
        lowStockCount,
        valuation,
      },
    }
  } catch (error) {
    console.error("[getInventoryStats] Error:", error)
    return { success: false, error: "Failed to fetch inventory stats" }
  }
}

/**
 * Create a new inventory item
 */
export async function createInventoryItem(
  cafeId: string,
  input: CreateInventoryItemInput
): Promise<ActionResult<{ item: InventoryItem }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: "Not authenticated" }
  }

  const isOwner = await checkCafeOwnership(cafeId, currentUser.id)
  if (!isOwner) {
    return { success: false, error: "Not authorized" }
  }

  // Validate input
  const validationResult = createInventoryItemSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  try {
    const [item] = await db
      .insert(inventoryItems)
      .values({
        cafeId,
        name: input.name,
        category: input.category,
        stock: input.stock,
        warningThreshold: input.warningThreshold,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
        link: input.link,
        status: "active",
      })
      .returning()

    revalidatePath(`/owner/cafes/${cafeId}/inventory`)

    const serializedItem: InventoryItem = {
      id: item!.id,
      cafeId: item!.cafeId,
      name: item!.name,
      sku: item!.sku,
      description: item!.description,
      category: item!.category,
      stock: item!.stock,
      warningThreshold: item!.warningThreshold,
      expiryDate: item!.expiryDate?.toISOString() ?? null,
      costPrice: item!.costPrice,
      lastRestocked: item!.lastRestocked?.toISOString() ?? null,
      link: item!.link,
      status: item!.status ?? "active",
      createdAt: item!.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: item!.updatedAt?.toISOString() ?? new Date().toISOString(),
    }

    return { success: true, data: { item: serializedItem } }
  } catch (error) {
    console.error("[createInventoryItem] Error:", error)
    return { success: false, error: "Failed to create inventory item" }
  }
}

/**
 * Update an inventory item
 */
export async function updateInventoryItem(
  itemId: string,
  input: UpdateInventoryItemInput
): Promise<ActionResult<{ item: InventoryItem }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: "Not authenticated" }
  }

  const isOwner = await checkItemOwnership(itemId, currentUser.id)
  if (!isOwner) {
    return { success: false, error: "Not authorized" }
  }

  // Validate input
  const validationResult = updateInventoryItemSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  try {
    const updateData: Partial<typeof inventoryItems.$inferInsert> = {}

    if (input.name !== undefined) updateData.name = input.name
    if (input.category !== undefined) updateData.category = input.category
    if (input.stock !== undefined) updateData.stock = input.stock
    if (input.warningThreshold !== undefined) updateData.warningThreshold = input.warningThreshold
    if (input.expiryDate !== undefined) {
      updateData.expiryDate = input.expiryDate ? new Date(input.expiryDate) : null
    }
    if (input.link !== undefined) updateData.link = input.link

    const [item] = await db
      .update(inventoryItems)
      .set(updateData)
      .where(eq(inventoryItems.id, itemId))
      .returning()

    const cafeId = item!.cafeId
    revalidatePath(`/owner/cafes/${cafeId}/inventory`)

    const serializedItem: InventoryItem = {
      id: item!.id,
      cafeId: item!.cafeId,
      name: item!.name,
      sku: item!.sku,
      description: item!.description,
      category: item!.category,
      stock: item!.stock,
      warningThreshold: item!.warningThreshold,
      expiryDate: item!.expiryDate?.toISOString() ?? null,
      costPrice: item!.costPrice,
      lastRestocked: item!.lastRestocked?.toISOString() ?? null,
      link: item!.link,
      status: item!.status ?? "active",
      createdAt: item!.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: item!.updatedAt?.toISOString() ?? new Date().toISOString(),
    }

    return { success: true, data: { item: serializedItem } }
  } catch (error) {
    console.error("[updateInventoryItem] Error:", error)
    return { success: false, error: "Failed to update inventory item" }
  }
}

/**
 * Soft delete an inventory item (set status to inactive)
 */
export async function softDeleteInventoryItem(itemId: string): Promise<ActionResult<void>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: "Not authenticated" }
  }

  const isOwner = await checkItemOwnership(itemId, currentUser.id)
  if (!isOwner) {
    return { success: false, error: "Not authorized" }
  }

  try {
    const [item] = await db
      .update(inventoryItems)
      .set({ status: "inactive" })
      .where(eq(inventoryItems.id, itemId))
      .returning({ cafeId: inventoryItems.cafeId })

    revalidatePath(`/owner/cafes/${item!.cafeId}/inventory`)

    return { success: true }
  } catch (error) {
    console.error("[softDeleteInventoryItem] Error:", error)
    return { success: false, error: "Failed to delete inventory item" }
  }
}

/**
 * Restore an inventory item (set status to active)
 */
export async function restoreInventoryItem(itemId: string): Promise<ActionResult<void>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: "Not authenticated" }
  }

  const isOwner = await checkItemOwnership(itemId, currentUser.id)
  if (!isOwner) {
    return { success: false, error: "Not authorized" }
  }

  try {
    const [item] = await db
      .update(inventoryItems)
      .set({ status: "active" })
      .where(eq(inventoryItems.id, itemId))
      .returning({ cafeId: inventoryItems.cafeId })

    revalidatePath(`/owner/cafes/${item!.cafeId}/inventory`)

    return { success: true }
  } catch (error) {
    console.error("[restoreInventoryItem] Error:", error)
    return { success: false, error: "Failed to restore inventory item" }
  }
}

/**
 * Adjust inventory stock (no history entry)
 */
export async function adjustInventoryStock(
  itemId: string,
  input: AdjustStockInput
): Promise<ActionResult<{ item: InventoryItem }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: "Not authenticated" }
  }

  const isOwner = await checkItemOwnership(itemId, currentUser.id)
  if (!isOwner) {
    return { success: false, error: "Not authorized" }
  }

  // Validate input
  const validationResult = adjustStockSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  try {
    // Get current stock
    const [currentItem] = await db
      .select({ stock: inventoryItems.stock, cafeId: inventoryItems.cafeId })
      .from(inventoryItems)
      .where(eq(inventoryItems.id, itemId))
      .limit(1)

    const newStock = currentItem!.stock + input.quantity
    if (newStock < 0) {
      return { success: false, error: "Stock cannot be negative" }
    }

    const [item] = await db
      .update(inventoryItems)
      .set({ stock: newStock })
      .where(eq(inventoryItems.id, itemId))
      .returning()

    revalidatePath(`/owner/cafes/${currentItem!.cafeId}/inventory`)

    const serializedItem: InventoryItem = {
      id: item!.id,
      cafeId: item!.cafeId,
      name: item!.name,
      sku: item!.sku,
      description: item!.description,
      category: item!.category,
      stock: item!.stock,
      warningThreshold: item!.warningThreshold,
      expiryDate: item!.expiryDate?.toISOString() ?? null,
      costPrice: item!.costPrice,
      lastRestocked: item!.lastRestocked?.toISOString() ?? null,
      link: item!.link,
      status: item!.status ?? "active",
      createdAt: item!.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: item!.updatedAt?.toISOString() ?? new Date().toISOString(),
    }

    return { success: true, data: { item: serializedItem } }
  } catch (error) {
    console.error("[adjustInventoryStock] Error:", error)
    return { success: false, error: "Failed to adjust stock" }
  }
}

/**
 * Restock an inventory item (writes history + updates stock)
 */
export async function restockInventoryItem(
  itemId: string,
  input: RestockInventoryItemInput
): Promise<ActionResult<{ item: InventoryItem; history: InventoryRestockHistory }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: "Not authenticated" }
  }

  const isOwner = await checkItemOwnership(itemId, currentUser.id)
  if (!isOwner) {
    return { success: false, error: "Not authorized" }
  }

  // Validate input
  const validationResult = restockInventoryItemSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  try {
    // Calculate total amount if not provided
    const totalAmount = input.totalAmount ?? (input.unitCost ? input.quantity * input.unitCost : null)

    // Get current item
    const [currentItem] = await db
      .select({ stock: inventoryItems.stock, cafeId: inventoryItems.cafeId, costPrice: inventoryItems.costPrice })
      .from(inventoryItems)
      .where(eq(inventoryItems.id, itemId))
      .limit(1)

    const newStock = currentItem!.stock + input.quantity

    // Use transaction to update stock and create history entry
    const [item] = await db
      .update(inventoryItems)
      .set({
        stock: newStock,
        lastRestocked: new Date(),
        // Update cost price if provided
        costPrice: input.unitCost ?? currentItem!.costPrice,
      })
      .where(eq(inventoryItems.id, itemId))
      .returning()

    const [historyEntry] = await db
      .insert(inventoryRestockHistory)
      .values({
        itemId,
        date: new Date(),
        quantity: input.quantity,
        unitCost: input.unitCost ?? null,
        totalAmount,
        proofUrl: input.proofUrl ?? null,
      })
      .returning()

    revalidatePath(`/owner/cafes/${currentItem!.cafeId}/inventory`)

    const serializedItem: InventoryItem = {
      id: item!.id,
      cafeId: item!.cafeId,
      name: item!.name,
      sku: item!.sku,
      description: item!.description,
      category: item!.category,
      stock: item!.stock,
      warningThreshold: item!.warningThreshold,
      expiryDate: item!.expiryDate?.toISOString() ?? null,
      costPrice: item!.costPrice,
      lastRestocked: item!.lastRestocked?.toISOString() ?? null,
      link: item!.link,
      status: item!.status ?? "active",
      createdAt: item!.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: item!.updatedAt?.toISOString() ?? new Date().toISOString(),
    }

    const serializedHistory: InventoryRestockHistory = {
      id: historyEntry!.id,
      itemId: historyEntry!.itemId,
      date: historyEntry!.date.toISOString(),
      quantity: historyEntry!.quantity,
      unitCost: historyEntry!.unitCost,
      totalAmount: historyEntry!.totalAmount,
      invoiceNumber: historyEntry!.invoiceNumber,
      proofUrl: historyEntry!.proofUrl,
      supplierName: historyEntry!.supplierName,
      orderReference: historyEntry!.orderReference,
      createdAt: historyEntry!.createdAt?.toISOString() ?? new Date().toISOString(),
    }

    return { success: true, data: { item: serializedItem, history: serializedHistory } }
  } catch (error) {
    console.error("[restockInventoryItem] Error:", error)
    return { success: false, error: "Failed to restock inventory item" }
  }
}

/**
 * Get restock history for an inventory item
 */
export async function getRestockHistory(
  itemId: string
): Promise<ActionResult<{ history: InventoryRestockHistory[] }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: "Not authenticated" }
  }

  const isOwner = await checkItemOwnership(itemId, currentUser.id)
  if (!isOwner) {
    return { success: false, error: "Not authorized" }
  }

  try {
    const history = await db
      .select()
      .from(inventoryRestockHistory)
      .where(eq(inventoryRestockHistory.itemId, itemId))
      .orderBy(desc(inventoryRestockHistory.date))

    const serializedHistory: InventoryRestockHistory[] = history.map((entry) => ({
      id: entry.id,
      itemId: entry.itemId,
      date: entry.date.toISOString(),
      quantity: entry.quantity,
      unitCost: entry.unitCost,
      totalAmount: entry.totalAmount,
      invoiceNumber: entry.invoiceNumber,
      proofUrl: entry.proofUrl,
      supplierName: entry.supplierName,
      orderReference: entry.orderReference,
      createdAt: entry.createdAt?.toISOString() ?? new Date().toISOString(),
    }))

    return { success: true, data: { history: serializedHistory } }
  } catch (error) {
    console.error("[getRestockHistory] Error:", error)
    return { success: false, error: "Failed to fetch restock history" }
  }
}

/**
 * Build CSV content for inventory export
 */
export async function buildInventoryCsv(items: InventoryItem[]): Promise<string> {
  const headers = [
    "Name",
    "SKU",
    "Category",
    "Stock",
    "Warning Threshold",
    "Low Stock",
    "Status",
    "Expiry Date",
    "Cost Price",
    "Link",
  ]

  const rows = items.map((item) => [
    `"${item.name.replace(/"/g, '""')}"`,
    item.sku ? `"${item.sku.replace(/"/g, '""')}"` : "",
    `"${item.category.replace(/"/g, '""')}"`,
    item.stock.toString(),
    item.warningThreshold.toString(),
    item.stock <= item.warningThreshold ? "Yes" : "No",
    item.status,
    item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "",
    item.costPrice?.toString() ?? "",
    item.link ?? "",
  ])

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
}

/**
 * Export inventory to CSV
 */
export async function exportInventoryToCSV(
  cafeId: string,
  filters?: InventoryFilters
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: "Not authenticated" }
  }

  const isOwner = await checkCafeOwnership(cafeId, currentUser.id)
  if (!isOwner) {
    return { success: false, error: "Not authorized" }
  }

  try {
    const result = await getInventoryItems(cafeId, filters)

    if (!result.success || !result.data) {
      return { success: false, error: result.error || "Failed to fetch inventory" }
    }

    const csv = await buildInventoryCsv(result.data.items)
    const filename = `inventory-${cafeId}-${new Date().toISOString().split("T")[0]}.csv`

    return { success: true, data: { csv, filename } }
  } catch (error) {
    console.error("[exportInventoryToCSV] Error:", error)
    return { success: false, error: "Failed to export inventory" }
  }
}
