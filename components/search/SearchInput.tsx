"use client"

import { forwardRef } from "react"
import { Search, Loader2 } from "lucide-react"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  isLoading?: boolean
  placeholder?: string
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, isLoading, placeholder }, ref) => (
    <div className="relative flex items-center px-4 py-4">
      <div className="absolute left-4 text-text/40">
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
      </div>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 text-lg bg-transparent outline-none placeholder:text-text/40 text-text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-4 p-1 rounded-full hover:bg-text/10 text-text/40 hover:text-text transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
)

SearchInput.displayName = "SearchInput"
