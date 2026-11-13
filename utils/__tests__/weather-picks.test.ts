import { describe, it, expect } from "bun:test"
import {
    classifyWeather,
    isRainyWeather,
    rankMenuItemsForWeather,
    weatherLabel,
    weatherReason,
    type RankableMenuItem,
    type WeatherSummary,
} from "@/utils/weather-picks"

function weather(overrides: Partial<WeatherSummary> = {}): WeatherSummary {
    return {
        tempC: 30,
        feelsLikeC: 30,
        humidity: 60,
        precipMM: 0,
        condition: "Partly cloudy",
        weatherCode: 116,
        ...overrides,
    }
}

function item(overrides: Partial<RankableMenuItem> & { name: string }): RankableMenuItem {
    return {
        id: overrides.name,
        price: 150,
        isSignature: false,
        isAvailable: true,
        isFood: false,
        isHot: false,
        isCold: false,
        sortOrder: 0,
        ...overrides,
    }
}

describe("isRainyWeather", () => {
    it("treats measurable precipitation as rain", () => {
        expect(isRainyWeather(weather({ precipMM: 0.4 }))).toBe(true)
    })

    it("uses the wttr.in code when precipitation is rounded to zero", () => {
        expect(isRainyWeather(weather({ precipMM: 0, weatherCode: 296 }))).toBe(true)
        expect(isRainyWeather(weather({ precipMM: 0, weatherCode: 113 }))).toBe(false)
    })
})

describe("classifyWeather", () => {
    it("prefers rainy over every other class", () => {
        expect(classifyWeather(weather({ precipMM: 2, feelsLikeC: 36, humidity: 90 }))).toBe("rainy")
    })

    it("classifies a hot afternoon", () => {
        expect(classifyWeather(weather({ tempC: 34, feelsLikeC: 38, humidity: 50 }))).toBe("hot")
    })

    it("classifies sticky-but-not-hot weather as humid", () => {
        expect(classifyWeather(weather({ tempC: 29, feelsLikeC: 31, humidity: 82 }))).toBe("humid")
    })

    it("treats high humidity at low felt temperature as mild, not humid", () => {
        expect(classifyWeather(weather({ tempC: 26, feelsLikeC: 26, humidity: 90 }))).toBe("mild")
    })

    it("classifies cool weather", () => {
        expect(classifyWeather(weather({ tempC: 19, feelsLikeC: 19, humidity: 40 }))).toBe("cool")
    })

    it("falls back to mild", () => {
        expect(classifyWeather(weather({ tempC: 27, feelsLikeC: 28, humidity: 60 }))).toBe("mild")
    })
})

describe("weatherReason", () => {
    it("quotes the station temperature, matching the UI chip", () => {
        // 26C air, 33C felt: the reason must not quote a different number than
        // weatherLabel() shows.
        const w = weather({ tempC: 26, feelsLikeC: 33.4 })
        expect(weatherReason(w)).toContain("26°C")
        expect(weatherLabel(w)).toContain("26°C")
    })

    it("explains a rainy day in terms of warmth", () => {
        expect(weatherReason(weather({ precipMM: 3 })).toLowerCase()).toContain("warm")
    })
})

describe("weatherLabel", () => {
    it("combines temperature and condition", () => {
        expect(weatherLabel(weather({ tempC: 31.6, condition: "Sunny" }))).toBe("32°C · Sunny")
    })

    it("degrades to temperature only", () => {
        expect(weatherLabel(weather({ tempC: 31, condition: "" }))).toBe("31°C")
    })
})

describe("rankMenuItemsForWeather", () => {
    const hotDay = weather({ tempC: 35, feelsLikeC: 38, humidity: 55 })
    const rainyDay = weather({ tempC: 26, feelsLikeC: 27, precipMM: 4, weatherCode: 302 })

    it("returns null with no items", () => {
        expect(rankMenuItemsForWeather([], hotDay)).toBeNull()
    })

    it("prefers a cold drink on a hot day", () => {
        const pick = rankMenuItemsForWeather(
            [
                item({ name: "Hot Americano", isHot: true }),
                item({ name: "Iced Latte", isCold: true }),
            ],
            hotDay
        )
        expect(pick?.item.name).toBe("Iced Latte")
    })

    it("prefers a hot drink on a rainy day", () => {
        const pick = rankMenuItemsForWeather(
            [
                item({ name: "Iced Latte", isCold: true }),
                item({ name: "Cappuccino", isHot: true }),
            ],
            rainyDay
        )
        expect(pick?.item.name).toBe("Cappuccino")
    })

    it("lets a signature cold drink beat a plain cold drink", () => {
        const pick = rankMenuItemsForWeather(
            [
                item({ name: "Iced Tea", isCold: true }),
                item({ name: "Iced Spanish Latte", isCold: true, isSignature: true }),
            ],
            hotDay
        )
        expect(pick?.item.name).toBe("Iced Spanish Latte")
    })

    it("still answers with a hot drink when a cafe has nothing cold", () => {
        const pick = rankMenuItemsForWeather(
            [item({ name: "Barako Pour Over", isHot: true, isSignature: true })],
            hotDay
        )
        expect(pick?.item.name).toBe("Barako Pour Over")
    })

    it("excludes food while drinks exist", () => {
        const pick = rankMenuItemsForWeather(
            [
                item({ name: "Iced Latte", isCold: true }),
                item({ name: "Croissant", isFood: true, isSignature: true }),
            ],
            hotDay
        )
        expect(pick?.item.name).toBe("Iced Latte")
    })

    it("falls back to food when the cafe lists no drinks", () => {
        const pick = rankMenuItemsForWeather(
            [item({ name: "Croissant", isFood: true, isSignature: true })],
            hotDay
        )
        expect(pick?.item.name).toBe("Croissant")
    })

    it("drops unavailable items below available ones", () => {
        const pick = rankMenuItemsForWeather(
            [
                item({ name: "Sold Out Iced Mocha", isCold: true, isSignature: true, isAvailable: false }),
                item({ name: "Iced Latte", isCold: true }),
            ],
            hotDay
        )
        expect(pick?.item.name).toBe("Iced Latte")
    })

    it("is deterministic when scores tie", () => {
        const items = [
            item({ name: "B Drink", isCold: true, sortOrder: 2 }),
            item({ name: "A Drink", isCold: true, sortOrder: 1 }),
        ]
        expect(rankMenuItemsForWeather(items, hotDay)?.item.name).toBe("A Drink")
        expect(rankMenuItemsForWeather([...items].reverse(), hotDay)?.item.name).toBe("A Drink")
    })

    it("carries a reason alongside the item", () => {
        const pick = rankMenuItemsForWeather([item({ name: "Iced Latte", isCold: true })], hotDay)
        expect(pick?.reason).toContain("35°C")
    })
})
