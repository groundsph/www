import { Coffee, Pencil, Trash2 } from "lucide-react"
import Image from "next/image"
import { UseMenuItemsReturn } from "@/utils/hooks/useMenuItems"

interface MenuSectionProps {
    menu: UseMenuItemsReturn
    colorScheme?: "primary" | "accent"
}

export default function MenuSection({
    menu,
    colorScheme = "primary",
}: MenuSectionProps) {
    const buttonBaseClasses =
        "inline-flex items-center gap-1 px-3 py-2 text-white rounded-lg text-sm font-medium transition-colors"
    const buttonColorClasses =
        colorScheme === "accent"
            ? "bg-accent hover:bg-accent/90"
            : "bg-primary hover:bg-primary/90"

    // Group items by category
    const categories = [...new Set(menu.items.map((item) => item.category))]

    return (
        <div className='space-y-6 [&_button]:cursor-pointer'>
            <div className='flex items-center justify-between'>
                <p className='text-text/60'>{menu.items.length} menu items</p>
                <button
                    onClick={menu.openCreateModal}
                    className={`${buttonBaseClasses} ${buttonColorClasses}`}
                >
                    + Add Item
                </button>
            </div>

            {menu.items.length === 0 ? (
                <div className='text-center py-8 text-text/50'>
                    <Coffee className='w-12 h-12 mx-auto mb-3 opacity-30' />
                    <p>No menu items yet</p>
                </div>
            ) : (
                <div className='space-y-6'>
                    {categories.map((category) => (
                        <div key={category}>
                            <h3 className='text-sm font-semibold text-text/70 uppercase tracking-wide mb-3'>
                                {category}
                            </h3>
                            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3'>
                                {menu.items
                                    .filter(
                                        (item) => item.category === category
                                    )
                                    .map((item) => (
                                        <div
                                            key={item.id}
                                            className={`relative p-3 rounded-xl border transition-all ${
                                                item.is_available
                                                    ? "bg-text/5 border-text/10"
                                                    : "bg-red-50 border-red-200 opacity-60"
                                            }`}
                                        >
                                            {/* Image */}
                                            {item.image_url && (
                                                <div className='relative w-full aspect-square rounded-lg overflow-hidden mb-2'>
                                                    <Image
                                                        src={item.image_url}
                                                        alt={item.name}
                                                        fill
                                                        className='object-cover'
                                                    />
                                                </div>
                                            )}

                                            {/* Item Info */}
                                            <div className='space-y-1'>
                                                <div className='flex items-start justify-between gap-1'>
                                                    <h4 className='font-medium text-sm leading-tight'>
                                                        {item.name}
                                                        {item.is_signature && (
                                                            <span className='ml-1 text-amber-500'>
                                                                ★
                                                            </span>
                                                        )}
                                                    </h4>
                                                </div>
                                                <p className='text-sm font-semibold text-primary'>
                                                    ₱{item.price.toFixed(0)}
                                                </p>
                                            </div>

                                            {/* Actions Row */}
                                            <div className='flex items-center justify-between mt-3 pt-2 border-t border-text/10'>
                                                {/* Availability Toggle */}
                                                <button
                                                    onClick={() =>
                                                        menu.toggleAvailability(
                                                            item
                                                        )
                                                    }
                                                    className={`relative w-10 h-5 rounded-full transition-colors ${
                                                        item.is_available
                                                            ? "bg-green-500"
                                                            : "bg-gray-300"
                                                    }`}
                                                    title={
                                                        item.is_available
                                                            ? "Mark as unavailable"
                                                            : "Mark as available"
                                                    }
                                                >
                                                    <span
                                                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                                            item.is_available
                                                                ? "translate-x-5"
                                                                : "translate-x-0"
                                                        }`}
                                                    />
                                                </button>

                                                {/* Edit/Delete Buttons */}
                                                <div className='flex items-center gap-1'>
                                                    <button
                                                        onClick={() =>
                                                            menu.openEditModal(
                                                                item
                                                            )
                                                        }
                                                        className='p-1.5 text-text/40 hover:text-text transition-colors rounded'
                                                        title='Edit item'
                                                    >
                                                        <Pencil className='w-3.5 h-3.5' />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            menu.deleteItem(
                                                                item
                                                            )
                                                        }
                                                        className='p-1.5 text-text/40 hover:text-red-500 transition-colors rounded'
                                                        title='Delete item'
                                                    >
                                                        <Trash2 className='w-3.5 h-3.5' />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
