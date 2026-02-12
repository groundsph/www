import { describe, expect, it } from "bun:test"
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  restockInventoryItemSchema,
  adjustStockSchema,
  inventoryFiltersSchema,
} from "@/utils/validation/inventory"

describe("createInventoryItemSchema", () => {
  it("rejects empty name", () => {
    const result = createInventoryItemSchema.safeParse({
      name: "",
      category: "Beans",
      stock: 1,
      warningThreshold: 1,
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty category", () => {
    const result = createInventoryItemSchema.safeParse({
      name: "Test Item",
      category: "",
      stock: 1,
      warningThreshold: 1,
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative stock", () => {
    const result = createInventoryItemSchema.safeParse({
      name: "Test Item",
      category: "Beans",
      stock: -1,
      warningThreshold: 1,
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative warningThreshold", () => {
    const result = createInventoryItemSchema.safeParse({
      name: "Test Item",
      category: "Beans",
      stock: 1,
      warningThreshold: -1,
    })
    expect(result.success).toBe(false)
  })

  it("accepts valid data without optional fields", () => {
    const result = createInventoryItemSchema.safeParse({
      name: "Test Item",
      category: "Beans",
      stock: 10,
      warningThreshold: 2,
    })
    expect(result.success).toBe(true)
  })

  it("accepts valid data with all fields", () => {
    const result = createInventoryItemSchema.safeParse({
      name: "Test Item",
      category: "Beans",
      stock: 10,
      warningThreshold: 2,
      expiryDate: "2025-12-31T00:00:00.000Z",
      link: "https://example.com",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid URL for link", () => {
    const result = createInventoryItemSchema.safeParse({
      name: "Test Item",
      category: "Beans",
      stock: 10,
      warningThreshold: 2,
      link: "not-a-url",
    })
    expect(result.success).toBe(false)
  })
})

describe("updateInventoryItemSchema", () => {
  it("accepts partial updates", () => {
    const result = updateInventoryItemSchema.safeParse({
      name: "Updated Name",
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty name when provided", () => {
    const result = updateInventoryItemSchema.safeParse({
      name: "",
    })
    expect(result.success).toBe(false)
  })

  it("accepts valid full update", () => {
    const result = updateInventoryItemSchema.safeParse({
      name: "Test Item",
      category: "Beans",
      stock: 10,
      warningThreshold: 2,
      expiryDate: "2025-12-31T00:00:00.000Z",
      link: "https://example.com",
    })
    expect(result.success).toBe(true)
  })
})

describe("restockInventoryItemSchema", () => {
  it("rejects quantity less than 1", () => {
    const result = restockInventoryItemSchema.safeParse({
      quantity: 0,
      unitCost: 10.5,
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative unitCost", () => {
    const result = restockInventoryItemSchema.safeParse({
      quantity: 5,
      unitCost: -1,
    })
    expect(result.success).toBe(false)
  })

  it("accepts valid restock without optional fields", () => {
    const result = restockInventoryItemSchema.safeParse({
      quantity: 5,
      unitCost: 10.5,
    })
    expect(result.success).toBe(true)
  })

  it("accepts valid restock with all fields", () => {
    const result = restockInventoryItemSchema.safeParse({
      quantity: 5,
      unitCost: 10.5,
      totalAmount: 52.5,
      proofUrl: "https://example.com/proof",
    })
    expect(result.success).toBe(true)
  })

  it("accepts zero unitCost", () => {
    const result = restockInventoryItemSchema.safeParse({
      quantity: 5,
      unitCost: 0,
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid URL for proofUrl", () => {
    const result = restockInventoryItemSchema.safeParse({
      quantity: 5,
      unitCost: 10.5,
      proofUrl: "not-a-url",
    })
    expect(result.success).toBe(false)
  })
})

describe("adjustStockSchema", () => {
  it("rejects quantity less than 1", () => {
    const result = adjustStockSchema.safeParse({
      quantity: 0,
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative quantity", () => {
    const result = adjustStockSchema.safeParse({
      quantity: -1,
    })
    expect(result.success).toBe(false)
  })

  it("accepts valid quantity", () => {
    const result = adjustStockSchema.safeParse({
      quantity: 5,
    })
    expect(result.success).toBe(true)
  })
})

describe("inventoryFiltersSchema", () => {
  it("accepts empty filters", () => {
    const result = inventoryFiltersSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("accepts category filter", () => {
    const result = inventoryFiltersSchema.safeParse({
      category: "Beans",
    })
    expect(result.success).toBe(true)
  })

  it("accepts lowStockOnly filter", () => {
    const result = inventoryFiltersSchema.safeParse({
      lowStockOnly: true,
    })
    expect(result.success).toBe(true)
  })

  it("accepts valid status filter", () => {
    const result = inventoryFiltersSchema.safeParse({
      status: "active",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid status filter", () => {
    const result = inventoryFiltersSchema.safeParse({
      status: "deleted",
    })
    expect(result.success).toBe(false)
  })

  it("accepts search filter", () => {
    const result = inventoryFiltersSchema.safeParse({
      search: "coffee",
    })
    expect(result.success).toBe(true)
  })

  it("accepts all filters together", () => {
    const result = inventoryFiltersSchema.safeParse({
      category: "Beans",
      lowStockOnly: true,
      status: "active",
      search: "arabica",
    })
    expect(result.success).toBe(true)
  })
})
