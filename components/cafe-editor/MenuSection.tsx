import { Coffee, Trash2 } from "lucide-react"
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

    return (
        <div className='space-y-4'>
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
                <div className='grid gap-2'>
                    {menu.items.map((item) => (
                        <div
                            key={item.id}
                            className='flex items-center gap-4 p-3 bg-text/5 rounded-lg border border-text/10'
                        >
                            <div className='flex-1 min-w-0'>
                                <div className='flex items-center gap-2'>
                                    <span className='font-medium'>
                                        {item.name}
                                    </span>
                                    {item.is_signature && (
                                        <span className='px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded'>
                                            ★
                                        </span>
                                    )}
                                    {!item.is_available && (
                                        <span className='px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded'>
                                            Off
                                        </span>
                                    )}
                                </div>
                                <p className='text-sm text-text/60'>
                                    {item.category} · ₱{item.price.toFixed(0)}
                                </p>
                            </div>
                            <div className='flex items-center gap-1'>
                                <button
                                    onClick={() => menu.openEditModal(item)}
                                    className='p-2 text-text/40 hover:text-text transition-colors'
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => menu.deleteItem(item)}
                                    className='p-2 text-text/40 hover:text-red-500 transition-colors'
                                >
                                    <Trash2 className='w-4 h-4' />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
