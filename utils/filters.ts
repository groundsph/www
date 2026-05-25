import { eq, SQL } from "drizzle-orm"
import { cafes } from "@/db/schema"

export function getProductionFilter(): SQL | undefined {
  if (process.env.NODE_ENV === "production") {
    return eq(cafes.isTest, false)
  }
  return undefined
}

export function omitTestCafes(conditions: (SQL | undefined)[]): (SQL | undefined)[] {
  const filter = getProductionFilter()
  if (filter) {
    conditions.push(filter)
  }
  return conditions
}