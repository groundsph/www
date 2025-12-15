import { Cafe, FeaturedCafe } from "./types/cafe";

export function getDailyFeatured(cafes: Cafe[]) {
    const dayOfYear = getDayOfYear(new Date())

    const cafe = cafes[dayOfYear % cafes.length]

    const featured: FeaturedCafe = {
        title: cafe.name,
        description: cafe.description,
        image: cafe.thumbnail,
        url: `/cafes/${cafe.slug}`,
        rating: cafe.rating,
        reviews: cafe.reviews,
    }

    return featured
}

export function getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}