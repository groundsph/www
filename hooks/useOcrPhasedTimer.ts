"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { OCR_PHASE_CONFIG, type OcrPhase } from "@/utils/ocr-stream-client"

export { OCR_PHASE_CONFIG }
export type { OcrPhase }

const PHASE_ORDER: OcrPhase[] = ["uploading", "ai-processing", "streaming", "processing-results"]

export function getPhaseProgress(phase: OcrPhase, elapsedMs: number): number {
    const config = OCR_PHASE_CONFIG[phase]
    const pct = Math.floor((elapsedMs / config.timeoutMs) * 100)
    return Math.min(pct, 100)
}

export function getOverallProgress(phase: OcrPhase, elapsedMs: number): number {
    const phaseIndex = PHASE_ORDER.indexOf(phase)
    const completedWeight = PHASE_ORDER.slice(0, phaseIndex).reduce(
        (sum, p) => sum + OCR_PHASE_CONFIG[p].timeoutMs, 0
    )
    const totalWeight = PHASE_ORDER.reduce(
        (sum, p) => sum + OCR_PHASE_CONFIG[p].timeoutMs, 0
    )
    const overall = (completedWeight + elapsedMs) / totalWeight
    return Math.min(Math.floor(overall * 100), 100)
}

interface UseOcrPhasedTimerReturn {
    phase: OcrPhase
    phaseElapsedMs: number
    phaseProgress: number
    overallProgress: number
    isPhaseTimedOut: boolean
    setPhase: (phase: OcrPhase) => void
    resetPhaseTimer: () => void
    start: () => void
    stop: () => void
}

export function useOcrPhasedTimer(): UseOcrPhasedTimerReturn {
    const [phase, setPhaseState] = useState<OcrPhase>("uploading")
    const [phaseElapsedMs, setPhaseElapsedMs] = useState(0)
    const [isRunning, setIsRunning] = useState(false)
    const [isPhaseTimedOut, setIsPhaseTimedOut] = useState(false)
    const phaseStartRef = useRef<number | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const clearTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
    }, [])

    const setPhase = useCallback((newPhase: OcrPhase) => {
        setPhaseState(newPhase)
        phaseStartRef.current = Date.now()
        setPhaseElapsedMs(0)
        setIsPhaseTimedOut(false)
    }, [])

    const resetPhaseTimer = useCallback(() => {
        phaseStartRef.current = Date.now()
        setPhaseElapsedMs(0)
        setIsPhaseTimedOut(false)
    }, [])

    const start = useCallback(() => {
        phaseStartRef.current = Date.now()
        setPhaseElapsedMs(0)
        setIsPhaseTimedOut(false)
        setIsRunning(true)
    }, [])

    const stop = useCallback(() => {
        setIsRunning(false)
        clearTimer()
    }, [clearTimer])

    useEffect(() => {
        if (!isRunning) {
            clearTimer()
            return
        }

        intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - (phaseStartRef.current ?? Date.now())
            setPhaseElapsedMs(elapsed)

            const timeout = OCR_PHASE_CONFIG[phase].timeoutMs
            if (elapsed >= timeout) {
                setIsPhaseTimedOut(true)
            }
        }, 100)

        return () => clearTimer()
    }, [isRunning, phase, clearTimer])

    return {
        phase,
        phaseElapsedMs,
        phaseProgress: getPhaseProgress(phase, phaseElapsedMs),
        overallProgress: getOverallProgress(phase, phaseElapsedMs),
        isPhaseTimedOut,
        setPhase,
        resetPhaseTimer,
        start,
        stop,
    }
}
