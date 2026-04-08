/**
 * Lightweight performance measurement utility for development
 * Use to measure component render times and identify bottlenecks
 * 
 * Usage Example:
 * 
 * import { measureRender } from "@/utils/performance"
 * 
 * function MyComponent() {
 *   if (process.env.NODE_ENV === "development") {
 *     const measure = measureRender("MyComponent")
 *     measure.start()
 *     
 *     useEffect(() => {
 *       measure.end()
 *     })
 *   }
 *   
 *   return <div>...</div>
 * }
 */

export interface PerformanceMeasure {
  start: () => void
  end: () => void
}

/**
 * Creates a performance measure for a component or operation
 * Only active in development mode
 * 
 * @example
 * const measure = measureRender("CafeList")
 * measure.start()
 * // ... render
 * measure.end()
 */
export function measureRender(componentName: string): PerformanceMeasure {
  if (process.env.NODE_ENV !== "development") {
    return { start: () => {}, end: () => {} }
  }

  const startMark = `${componentName}-render-start`
  const endMark = `${componentName}-render-end`
  const measureName = `${componentName}-render`

  return {
    start: () => {
      performance.mark(startMark)
    },
    end: () => {
      performance.mark(endMark)
      performance.measure(measureName, startMark, endMark)
      
      // Log to console for easy viewing
      const entries = performance.getEntriesByName(measureName)
      const latest = entries[entries.length - 1]
      if (latest) {
        console.log(`[Performance] ${componentName}: ${latest.duration.toFixed(2)}ms`)
      }
    },
  }
}

/**
 * Clear all performance marks and measures for a component
 */
export function clearMeasures(componentName: string): void {
  if (process.env.NODE_ENV !== "development") return
  
  const measureName = `${componentName}-render`
  performance.clearMarks(`${componentName}-render-start`)
  performance.clearMarks(`${componentName}-render-end`)
  performance.clearMeasures(measureName)
}

/**
 * Get all performance measurements for a component
 */
export function getMeasures(componentName: string): PerformanceEntry[] {
  if (process.env.NODE_ENV !== "development") return []
  
  return performance.getEntriesByName(`${componentName}-render`)
}
