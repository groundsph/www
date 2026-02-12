import { z } from "zod"

export const createInventoryItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  stock: z.number().int().min(0, "Stock must be 0 or greater"),
  warningThreshold: z.number().int().min(0, "Warning threshold must be 0 or greater"),
  expiryDate: z.string().datetime().optional(),
  link: z.string().url("Must be a valid URL").optional(),
})

export const updateInventoryItemSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  category: z.string().min(1, "Category is required").optional(),
  stock: z.number().int().min(0, "Stock must be 0 or greater").optional(),
  warningThreshold: z.number().int().min(0, "Warning threshold must be 0 or greater").optional(),
  expiryDate: z.string().datetime().optional(),
  link: z.string().url("Must be a valid URL").optional(),
})

export const restockInventoryItemSchema = z.object({
  quantity: z.number().int().min(1, "Quantity must be greater than 0"),
  unitCost: z.number().min(0, "Unit cost must be 0 or greater"),
  totalAmount: z.number().min(0, "Total amount must be 0 or greater").optional(),
  proofUrl: z.string().url("Must be a valid URL").optional(),
})

export const adjustStockSchema = z.object({
  quantity: z.number().int().min(1, "Quantity must be greater than 0"),
})

export const inventoryFiltersSchema = z.object({
  category: z.string().optional(),
  lowStockOnly: z.boolean().optional(),
  status: z.enum(["active", "inactive", "all"]).optional(),
  search: z.string().optional(),
})

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>
export type RestockInventoryItemInput = z.infer<typeof restockInventoryItemSchema>
export type AdjustStockInput = z.infer<typeof adjustStockSchema>
export type InventoryFiltersInput = z.infer<typeof inventoryFiltersSchema>
