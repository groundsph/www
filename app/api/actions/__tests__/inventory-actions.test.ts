import { describe, expect, it } from "bun:test"
import { buildInventoryCsv } from "@/app/api/actions/inventory"

describe("buildInventoryCsv", () => {
  it("includes headers", async () => {
    const csv = await buildInventoryCsv([
      {
        id: "test-1",
        cafeId: "cafe-1",
        name: "Beans",
        sku: null,
        description: null,
        category: "Raw",
        stock: 2,
        warningThreshold: 1,
        expiryDate: null,
        costPrice: null,
        lastRestocked: null,
        link: null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    expect(csv.split("\n")[0]).toContain("Name")
    expect(csv.split("\n")[0]).toContain("Category")
    expect(csv.split("\n")[0]).toContain("Stock")
  })

  it("includes item data", async () => {
    const csv = await buildInventoryCsv([
      {
        id: "test-1",
        cafeId: "cafe-1",
        name: "Ethiopian Beans",
        sku: "BEAN-001",
        description: null,
        category: "Raw",
        stock: 10,
        warningThreshold: 5,
        expiryDate: null,
        costPrice: 500,
        lastRestocked: null,
        link: null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    const lines = csv.split("\n")
    expect(lines.length).toBe(2)
    expect(lines[1]).toContain("Ethiopian Beans")
    expect(lines[1]).toContain("Raw")
    expect(lines[1]).toContain("10")
  })

  it("escapes quotes in names", async () => {
    const csv = await buildInventoryCsv([
      {
        id: "test-1",
        cafeId: "cafe-1",
        name: 'Special "Reserve" Beans',
        sku: null,
        description: null,
        category: "Raw",
        stock: 2,
        warningThreshold: 1,
        expiryDate: null,
        costPrice: null,
        lastRestocked: null,
        link: null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    expect(csv).toContain('"Special ""Reserve"" Beans"')
  })

  it("marks low stock items correctly", async () => {
    const csv = await buildInventoryCsv([
      {
        id: "test-1",
        cafeId: "cafe-1",
        name: "Low Stock Item",
        sku: null,
        description: null,
        category: "Raw",
        stock: 1,
        warningThreshold: 5,
        expiryDate: null,
        costPrice: null,
        lastRestocked: null,
        link: null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    expect(csv).toContain("Yes")
  })

  it("marks normal stock items correctly", async () => {
    const csv = await buildInventoryCsv([
      {
        id: "test-1",
        cafeId: "cafe-1",
        name: "Normal Stock Item",
        sku: null,
        description: null,
        category: "Raw",
        stock: 10,
        warningThreshold: 5,
        expiryDate: null,
        costPrice: null,
        lastRestocked: null,
        link: null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    expect(csv).toContain("No")
  })

  it("handles multiple items", async () => {
    const csv = await buildInventoryCsv([
      {
        id: "test-1",
        cafeId: "cafe-1",
        name: "Item 1",
        sku: "SKU-1",
        description: null,
        category: "Beans",
        stock: 10,
        warningThreshold: 5,
        expiryDate: null,
        costPrice: 100,
        lastRestocked: null,
        link: null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "test-2",
        cafeId: "cafe-1",
        name: "Item 2",
        sku: "SKU-2",
        description: null,
        category: "Equipment",
        stock: 3,
        warningThreshold: 5,
        expiryDate: null,
        costPrice: 200,
        lastRestocked: null,
        link: "https://example.com",
        status: "inactive",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    const lines = csv.split("\n")
    expect(lines.length).toBe(3)
    expect(lines[1]).toContain("Item 1")
    expect(lines[1]).toContain("Beans")
    expect(lines[2]).toContain("Item 2")
    expect(lines[2]).toContain("Equipment")
    expect(lines[2]).toContain("https://example.com")
  })

  it("handles null values gracefully", async () => {
    const csv = await buildInventoryCsv([
      {
        id: "test-1",
        cafeId: "cafe-1",
        name: "Minimal Item",
        sku: null,
        description: null,
        category: "Other",
        stock: 0,
        warningThreshold: 0,
        expiryDate: null,
        costPrice: null,
        lastRestocked: null,
        link: null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    const lines = csv.split("\n")
    expect(lines[1]).toContain("Minimal Item")
    expect(lines[1]).toContain("Other")
    expect(lines[1]).toContain("0")
  })
})

describe("inventory server actions exist", () => {
  it("getInventoryItems is a function", async () => {
    const { getInventoryItems } = await import("@/app/api/actions/inventory")
    expect(typeof getInventoryItems).toBe("function")
  })

  it("getInventoryStats is a function", async () => {
    const { getInventoryStats } = await import("@/app/api/actions/inventory")
    expect(typeof getInventoryStats).toBe("function")
  })

  it("createInventoryItem is a function", async () => {
    const { createInventoryItem } = await import("@/app/api/actions/inventory")
    expect(typeof createInventoryItem).toBe("function")
  })

  it("updateInventoryItem is a function", async () => {
    const { updateInventoryItem } = await import("@/app/api/actions/inventory")
    expect(typeof updateInventoryItem).toBe("function")
  })

  it("softDeleteInventoryItem is a function", async () => {
    const { softDeleteInventoryItem } = await import("@/app/api/actions/inventory")
    expect(typeof softDeleteInventoryItem).toBe("function")
  })

  it("restoreInventoryItem is a function", async () => {
    const { restoreInventoryItem } = await import("@/app/api/actions/inventory")
    expect(typeof restoreInventoryItem).toBe("function")
  })

  it("adjustInventoryStock is a function", async () => {
    const { adjustInventoryStock } = await import("@/app/api/actions/inventory")
    expect(typeof adjustInventoryStock).toBe("function")
  })

  it("restockInventoryItem is a function", async () => {
    const { restockInventoryItem } = await import("@/app/api/actions/inventory")
    expect(typeof restockInventoryItem).toBe("function")
  })

  it("getRestockHistory is a function", async () => {
    const { getRestockHistory } = await import("@/app/api/actions/inventory")
    expect(typeof getRestockHistory).toBe("function")
  })

  it("exportInventoryToCSV is a function", async () => {
    const { exportInventoryToCSV } = await import("@/app/api/actions/inventory")
    expect(typeof exportInventoryToCSV).toBe("function")
  })
})
