import { z } from "zod"

export const inventoryItemSchema = z.object({
  id: z.string(),
  cafeId: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string(),
  stock: z.number(),
  warningThreshold: z.number(),
  expiryDate: z.string().nullable(),
  costPrice: z.number().nullable(),
  lastRestocked: z.string().nullable(),
  link: z.string().nullable(),
  status: z.enum(["active", "inactive"]),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const inventoryRestockHistorySchema = z.object({
  id: z.string(),
  itemId: z.string(),
  date: z.string(),
  quantity: z.number(),
  unitCost: z.number().nullable(),
  totalAmount: z.number().nullable(),
  invoiceNumber: z.string().nullable(),
  proofUrl: z.string().nullable(),
  supplierName: z.string().nullable(),
  orderReference: z.string().nullable(),
  createdAt: z.string(),
})

export const inventoryStatsSchema = z.object({
  totalItems: z.number(),
  lowStockCount: z.number(),
  valuation: z.number(),
})

export type InventoryItem = z.infer<typeof inventoryItemSchema>
export type InventoryRestockHistory = z.infer<typeof inventoryRestockHistorySchema>
export type InventoryStats = z.infer<typeof inventoryStatsSchema>

export interface InventoryFilters {
  category?: string
  lowStockOnly?: boolean
  status?: "active" | "inactive" | "all"
  search?: string
}

export interface InventoryItemWithHistory extends InventoryItem {
  restockHistory?: InventoryRestockHistory[]
}
