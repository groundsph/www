import { z } from "zod"

export const priceLevelEnum = z.enum(["budget", "mid", "premium", "luxury"])

export const cafeSubmissionSchema = z.object({
  name: z.string().trim().min(1, "Cafe name is required"),
  description: z.string().trim().optional().default(""),
  region: z.string().trim().min(1, "Region is required"),
  province: z.string().trim().min(1, "Province is required"),
  city_municipality: z.string().trim().min(1, "City/Municipality is required"),
  area: z.string().trim().optional().default(""),
  address_display: z.string().trim().optional().default(""),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  price_level: priceLevelEnum,
  payment_methods: z.string().trim().optional().default(""),
  has_wifi: z.boolean().optional().default(false),
  has_smoking: z.boolean().optional().default(false),
  has_sockets: z.boolean().optional().default(false),
  has_parking: z.boolean().optional().default(false),
  has_aircon: z.boolean().optional().default(false),
  is_pet_friendly: z.boolean().optional().default(false),
  has_outdoor_seating: z.boolean().optional().default(false),
  has_indoor_seating: z.boolean().optional().default(false),
  has_restroom: z.boolean().optional().default(false),
  has_bidet: z.boolean().optional().default(false),
  has_non_dairy: z.boolean().optional().default(false),
  has_decaf: z.boolean().optional().default(false),
  milk_options: z.array(z.string()).optional().default([]),
  serves_food: z.boolean().optional().default(false),
  is_work_friendly: z.boolean().optional().default(false),
  operating_hours: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  socials: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  website_url: z.string().trim().url().optional().or(z.literal("")),
  phone: z.string().trim().optional().default(""),
  email: z.string().trim().email().optional().or(z.literal("")),
  specialty: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  brew_methods: z.array(z.string()).optional().default([]),
  roaster: z.string().trim().optional().default(""),
  is_hidden_gem: z.boolean().optional().default(false),
  finding_hint: z.string().trim().optional().default(""),
  is_chain: z.boolean().optional().default(false),
  is_halal_certified: z.boolean().optional().default(false),
  straw_type: z.string().trim().optional().default(""),
  straw_type_other: z.string().trim().optional().default(""),
}).refine(
  (data) => data.is_hidden_gem || data.address_display.trim().length > 0,
  { message: "Address is required for non-hidden-gem cafes", path: ["address_display"] }
).refine(
  (data) => data.is_hidden_gem || (data.lat !== null && data.lng !== null),
  { message: "Location coordinates are required", path: ["lat"] }
)

export type CafeSubmissionInput = z.infer<typeof cafeSubmissionSchema>

export interface SubmitError {
  code: "VALIDATION" | "AUTH" | "DB" | "UPLOAD" | "NETWORK" | "UNKNOWN"
  message: string
  field?: string
  details?: string
  retryable?: boolean
}

export class CafeSubmissionError {
  static fromZod(error: z.ZodError<CafeSubmissionInput>): SubmitError {
    const firstIssue = error.issues[0]
    return {
      code: "VALIDATION",
      message: firstIssue?.message ?? "Invalid submission data",
      field: firstIssue?.path.join(".") ?? undefined,
      retryable: true,
    }
  }

  static auth(): SubmitError {
    return { code: "AUTH", message: "Please log in to submit a cafe", retryable: false }
  }

  static db(message: string = "We couldn't save your cafe right now. Please try again."): SubmitError {
    return { code: "DB", message, retryable: true }
  }

  static duplicate(message: string): SubmitError {
    return { code: "VALIDATION", message, field: "name", retryable: false }
  }

  static unknown(details?: string): SubmitError {
    return {
      code: "UNKNOWN",
      message: "Something went wrong. Please try again later.",
      details,
      retryable: true,
    }
  }
}