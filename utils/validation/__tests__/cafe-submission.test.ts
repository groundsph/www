import { describe, it, expect } from "bun:test"
import { cafeSubmissionSchema, CafeSubmissionError } from "@/utils/validation/cafe-submission"

const validSubmission = {
  name: "Test Cafe",
  description: "A nice place",
  region: "NCR - National Capital Region",
  province: "Metro Manila",
  city_municipality: "Makati",
  area: "Legazpi Village",
  address_display: "123 Ayala Ave, Makati",
  lat: 14.5547,
  lng: 121.0244,
  price_level: "mid",
  payment_methods: "Cash, GCash",
  has_wifi: false,
  has_smoking: false,
  has_sockets: true,
  has_parking: false,
  has_aircon: true,
  is_pet_friendly: false,
  has_outdoor_seating: true,
  has_indoor_seating: true,
  has_restroom: true,
  has_bidet: false,
  has_non_dairy: true,
  has_decaf: true,
  milk_options: ["oat", "soy"],
  serves_food: true,
  is_work_friendly: true,
  operating_hours: [],
  socials: [],
  website_url: "",
  phone: "",
  email: "",
  specialty: ["latte"],
  tags: ["cozy"],
  brew_methods: ["pour-over"],
  roaster: "Local Roaster",
  is_hidden_gem: false,
  finding_hint: "",
  is_chain: false,
  is_halal_certified: false,
  straw_type: "",
  straw_type_other: "",
}

describe("cafeSubmissionSchema", () => {
  it("accepts a valid submission", () => {
    const result = cafeSubmissionSchema.safeParse(validSubmission)
    expect(result.success).toBe(true)
  })

  it("rejects empty name", () => {
    const result = cafeSubmissionSchema.safeParse({ ...validSubmission, name: "   " })
    expect(result.success).toBe(false)
  })

  it("rejects missing region", () => {
    const result = cafeSubmissionSchema.safeParse({ ...validSubmission, region: "" })
    expect(result.success).toBe(false)
  })

  it("rejects missing province", () => {
    const result = cafeSubmissionSchema.safeParse({ ...validSubmission, province: "" })
    expect(result.success).toBe(false)
  })

  it("rejects missing city_municipality", () => {
    const result = cafeSubmissionSchema.safeParse({ ...validSubmission, city_municipality: "" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid price_level", () => {
    const result = cafeSubmissionSchema.safeParse({ ...validSubmission, price_level: "free" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid lat/lng values", () => {
    const result = cafeSubmissionSchema.safeParse({ ...validSubmission, lat: 200 })
    expect(result.success).toBe(false)
  })

  it("allows hidden gem without address_display", () => {
    const result = cafeSubmissionSchema.safeParse({
      ...validSubmission,
      is_hidden_gem: true,
      address_display: "",
      lat: null,
      lng: null,
    })
    expect(result.success).toBe(true)
  })

  it("rejects non-hidden-gem without address_display", () => {
    const result = cafeSubmissionSchema.safeParse({
      ...validSubmission,
      is_hidden_gem: false,
      address_display: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects non-hidden-gem with null coordinates", () => {
    const result = cafeSubmissionSchema.safeParse({
      ...validSubmission,
      lat: null,
      lng: null,
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid URL in website_url", () => {
    const result = cafeSubmissionSchema.safeParse({ ...validSubmission, website_url: "not-a-url" })
    expect(result.success).toBe(false)
  })

  it("accepts empty website_url", () => {
    const result = cafeSubmissionSchema.safeParse({ ...validSubmission, website_url: "" })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email format", () => {
    const result = cafeSubmissionSchema.safeParse({ ...validSubmission, email: "not-an-email" })
    expect(result.success).toBe(false)
  })
})

describe("CafeSubmissionError", () => {
  it("formats validation errors for client display", () => {
    const result = cafeSubmissionSchema.safeParse({ ...validSubmission, name: "" })
    if (!result.success) {
      const formatted = CafeSubmissionError.fromZod(result.error)
      expect(formatted.code).toBe("VALIDATION")
      expect(formatted.field).toBeDefined()
      expect(formatted.message).not.toBe("")
      expect(formatted.retryable).toBe(true)
    }
  })
})