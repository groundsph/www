import { Cafe } from "./types/cafe";

export function getDailyFeatured(cafes: Cafe[]) {
    const dayOfYear = getDayOfYear(new Date())

    return cafes[dayOfYear % cafes.length]
}

export function getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}