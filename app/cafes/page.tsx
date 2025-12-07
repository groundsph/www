"use client"

import { dummyCafes } from "@/utils/dummy/cafes"
import Image from "next/image"
import { useState } from "react"

export default function CafesPage() {
    // Constants
    // States
    const [search, setSearch] = useState("")
    const [filters, setFilters] = useState({
        rating: 0,
        price: 0,
        type: "",
    })
    return (
        <section className='w-full min-h-max px-4 py-6 flex flex-col gap-4'>
            <h2 className='font-semibold font-serif text-2xl w-full text-center'>
                Cafes
            </h2>
            <div className='flex flex-row gap-4'>
                <input
                    type='text'
                    placeholder='Search'
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className='w-full p-2 border border-border rounded-lg'
                />
                <div className='flex flex-row gap-2'>
                    <select
                        value={filters.rating}
                        onChange={(e) =>
                            setFilters({
                                ...filters,
                                rating: parseInt(e.target.value),
                            })
                        }
                        className='w-full p-2 border border-border rounded-lg'
                    >
                        <option value={0}>Rating</option>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={5}>5</option>
                    </select>
                    <select
                        value={filters.price}
                        onChange={(e) =>
                            setFilters({
                                ...filters,
                                price: parseInt(e.target.value),
                            })
                        }
                        className='w-full p-2 border border-border rounded-lg'
                    >
                        <option value={0}>Price</option>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={5}>5</option>
                    </select>
                    <select
                        value={filters.type}
                        onChange={(e) =>
                            setFilters({
                                ...filters,
                                type: e.target.value,
                            })
                        }
                        className='w-full p-2 border border-border rounded-lg'
                    >
                        <option value={""}>Type</option>
                        <option value={"cafe"}>Cafe</option>
                        <option value={"bar"}>Bar</option>
                        <option value={"restaurant"}>Restaurant</option>
                        <option value={"other"}>Other</option>
                    </select>
                </div>
            </div>
            <div className='flex flex-col gap-4'>
                {dummyCafes
                    .filter((cafe) =>
                        cafe.name.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((cafe) => (
                        <div
                            key={cafe.id}
                            className='flex flex-row justify-between gap-2 h-80'
                        >
                            <div className='flex flex-col flex-1'>
                                <h3 className='font-semibold font-serif text-lg'>
                                    {cafe.name}
                                </h3>
                                <p className='text-sm'>
                                    {cafe.address_display}
                                </p>
                            </div>
                            <div className='relative w-auto aspect-video'>
                                <Image
                                    src={cafe.thumbnail}
                                    alt=''
                                    fill
                                    className='object-cover'
                                />
                            </div>
                        </div>
                    ))}
            </div>
        </section>
    )
}
