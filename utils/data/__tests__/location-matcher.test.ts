import { describe, it, expect } from "bun:test";
import { matchNominatimToLocation } from "../location-matcher";

describe("LocationMatcher", () => {
    describe("Phase 1 Test Cases", () => {
        it("P1-T01: Cebu City, Cebu, Region VII", () => {
            const result = matchNominatimToLocation({
                display_name: "Cebu City, Cebu, Philippines",
                address: {
                    city: "Cebu City",
                    state: "Cebu",
                    country: "Philippines",
                },
            });

            expect(result.region).toBe("Region VII - Central Visayas");
            expect(result.province).toBe("Cebu");
            expect(result.city).toBe("Cebu City");
        });

        it("P1-T02: Makati, Metro Manila, NCR", () => {
            const result = matchNominatimToLocation({
                display_name: "Makati, Metro Manila, Philippines",
                address: {
                    city: "Makati",
                    state: "Metro Manila",
                    country: "Philippines",
                },
            });

            expect(result.region).toBe("NCR - National Capital Region");
            expect(result.province).toBe("Metro Manila");
            expect(result.city).toBe("Makati");
        });

        it("P1-T03: Baguio City, Benguet, CAR", () => {
            const result = matchNominatimToLocation({
                display_name: "Baguio City, Benguet, Philippines",
                address: {
                    city: "Baguio City",
                    state: "Benguet",
                    country: "Philippines",
                },
            });

            expect(result.region).toBe("CAR - Cordillera Administrative Region");
            expect(result.province).toBe("Benguet");
            expect(result.city).toBe("Baguio City");
        });

        it("P1-T04: Davao City, Davao del Sur, Region XI", () => {
            const result = matchNominatimToLocation({
                display_name: "Davao City, Davao del Sur, Philippines",
                address: {
                    city: "Davao City",
                    state: "Davao del Sur",
                    country: "Philippines",
                },
            });

            expect(result.region).toBe("Region XI - Davao Region");
            expect(result.province).toBe("Davao del Sur");
            expect(result.city).toBe("Davao City");
        });

        it("P1-T05: Los Baños, Laguna, CALABARZON", () => {
            const result = matchNominatimToLocation({
                display_name: "Los Baños, Laguna, Philippines",
                address: {
                    city: "Los Baños",
                    state: "Laguna",
                    country: "Philippines",
                },
            });

            expect(result.region).toBe("Region IV-A - CALABARZON");
            expect(result.province).toBe("Laguna");
            expect(result.city).toBe("Los Baños");
        });

        it("P1-T06: Iloilo City, Iloilo, Region VI", () => {
            const result = matchNominatimToLocation({
                display_name: "Iloilo City, Iloilo, Philippines",
                address: {
                    city: "Iloilo City",
                    state: "Iloilo",
                    country: "Philippines",
                },
            });

            expect(result.region).toBe("Region VI - Western Visayas");
            expect(result.province).toBe("Iloilo");
            expect(result.city).toBe("Iloilo City");
        });

        it("P1-T07: Angeles City, Pampanga, Region III", () => {
            const result = matchNominatimToLocation({
                display_name: "Angeles City, Pampanga, Philippines",
                address: {
                    city: "Angeles City",
                    state: "Pampanga",
                    country: "Philippines",
                },
            });

            expect(result.region).toBe("Region III - Central Luzon");
            expect(result.province).toBe("Pampanga");
            expect(result.city).toBe("Angeles City");
        });

        it("P1-T08: Puerto Princesa City, Palawan, MIMAROPA", () => {
            const result = matchNominatimToLocation({
                display_name: "Puerto Princesa City, Palawan, Philippines",
                address: {
                    city: "Puerto Princesa City",
                    state: "Palawan",
                    country: "Philippines",
                },
            });

            expect(result.region).toBe("Region IV-B - MIMAROPA");
            expect(result.province).toBe("Palawan");
            expect(result.city).toBe("Puerto Princesa City");
        });
    });
});
