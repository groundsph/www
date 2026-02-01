import { useEffect, useCallback } from "react"

export function useSearchKeyboard(onOpen: () => void) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "k") {
      event.preventDefault()
      onOpen()
    }
  }, [onOpen])

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}
