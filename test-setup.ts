import { JSDOM } from "jsdom"

const dom = new JSDOM("<html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
    resources: "usable",
})

global.document = dom.window.document
global.window = dom.window as unknown as Window & typeof globalThis
global.navigator = dom.window.navigator
global.Element = dom.window.Element
global.HTMLElement = dom.window.HTMLElement
global.HTMLCanvasElement = dom.window.HTMLCanvasElement
global.HTMLElement.prototype.scrollIntoView = function () {
    return null
}

// Canvas getContext mock — JSDOM doesn't implement HTMLCanvasElement.getContext()
const mockCtx: Partial<CanvasRenderingContext2D> = {
    measureText: () => ({ width: 100, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 } as TextMetrics),
    fillText: () => {},
    strokeText: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    setTransform: () => {},
    clip: () => {},
    drawImage: () => {},
    canvas: { width: 0, height: 0 } as unknown as HTMLCanvasElement,
    font: "",
    textAlign: "" as CanvasTextAlign,
    textBaseline: "" as CanvasTextBaseline,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "" as CanvasLineCap,
    lineJoin: "" as CanvasLineJoin,
    miterLimit: 0,
    globalAlpha: 0,
    globalCompositeOperation: "" as GlobalCompositeOperation,
}

HTMLCanvasElement.prototype.getContext = function (contextId: string) {
    if (contextId === "2d") {
        return mockCtx as CanvasRenderingContext2D
    }
    return null
}

HTMLCanvasElement.prototype.toDataURL = function () {
    return "data:image/png;base64,"
}

HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
    callback(new Blob([]), null as unknown as any)
}

global.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(callback, 0) as unknown as number
}
global.cancelAnimationFrame = (id: number) => {
    clearTimeout(id)
}

// Ensure Resend SDK doesn't throw at import time
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_test_dummy_key"